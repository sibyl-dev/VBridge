import { Feature, FeatureMeta } from "data/feature";
import { PatientMeta } from "data/patient";
import * as React from "react";
import * as d3 from "d3";
import { Button, Divider, Tooltip, Input, Popover, Slider } from "antd"
import { getFeatureMatrix, getFeatureValues, getSHAPValues, getWhatIfSHAPValues } from "router/api";
import { DataFrame, IDataFrame } from "data-forge";
import * as _ from "lodash"
import { getScaleLinear, beautifulPrinter, defaultCategoricalColor } from "visualization/common";
import {
    ArrowDownOutlined, ArrowLeftOutlined, ArrowRightOutlined, ArrowUpOutlined, CaretRightOutlined, FilterOutlined, LineChartOutlined,
    QuestionCircleFilled,
    QuestionOutlined,
    SortAscendingOutlined, TableOutlined
} from "@ant-design/icons"
import { ItemDict } from "data/table";
import Histogram from "visualization/Histogram";
import { arrayShallowCompare, getReferenceValue, isDefined, ReferenceValue } from "data/common";

import "./index.scss"

export interface FeatureViewProps {
    className?: string,
    patientMeta?: PatientMeta,
    tableNames?: string[],
    featureMeta: IDataFrame<number, FeatureMeta>,
    prediction: number,
    groupIds?: number[],
    itemDicts?: ItemDict,
    entityCategoricalColor?: (entityName: string | undefined) => string,
    abnormalityColor?: (abnoramlity: number) => string,
    focusedFeatures: string[],
    display?: 'normal' | 'dense',
    inspectFeatureInSignal?: (feature: Feature) => void,
    inspectFeatureInTable?: (feature: Feature) => void,
    target: string,
}

export interface FeatureViewStates {
    featureDisplayValues?: DataFrame,
    features?: IDataFrame<number, Feature>,
    shapValues?: number[],
    featureMatrix?: IDataFrame<number, any>,
    selectedMatrix?: IDataFrame<number, any>,
    selectedMatWithDesiredOutputs?: IDataFrame<number, any>,
    selectedMatWithoutDesiredOutputs?: IDataFrame<number, any>,
    referenceValues?: IDataFrame<string, ReferenceValue>,
}

export default class FeatureView extends React.Component<FeatureViewProps, FeatureViewStates> {

    constructor(props: FeatureViewProps) {
        super(props);

        this.state = {};
        this.defaultCellWidth = this.defaultCellWidth.bind(this);
        this.getReferenceValues = this.getReferenceValues.bind(this);
        this.updateReferenceValues = this.updateReferenceValues.bind(this);
    }

    componentDidMount() {
        this.loadFeatureMatAndRefs();
        this.updateFeatures();
    }

    // only run ones
    private async loadFeatureMatAndRefs() {
        const { featureMeta } = this.props;
        const featureMatrix = await getFeatureMatrix();
        this.setState({ featureMatrix });
    }

    // run when the group ids updates
    private updateReferenceValues() {
        const { featureMeta, groupIds, target } = this.props;
        const { featureMatrix } = this.state;
        if (featureMatrix) {
            const featureNames = featureMeta.getSeries('name').toArray() as string[];
            const selectedVectors = groupIds && groupIds.map(id => featureMatrix.at(id));
            if (selectedVectors?.length == 0) {
                alert("No patient in the selection.");
            }
            else if(selectedVectors){
                console.log('selectedVectors', selectedVectors, selectedVectors&&selectedVectors[0]?'true':'false')
                const selectedMatrix = selectedVectors && selectedVectors[0] ? new DataFrame(selectedVectors) : featureMatrix;
                const selectedMatWithDesiredOutputs = selectedMatrix.where(row => row['complication'] === 0);
                const selectedMatWithoutDesiredOutputs = selectedMatrix.where(row => row['complication'] !== 0);
                if (selectedMatWithDesiredOutputs.count() == 0) alert("No patient in the selection.");
                else {
                    const referenceValues = new DataFrame({
                        index: featureNames,
                        values: featureNames.map(name => 
                             getReferenceValue(selectedMatWithDesiredOutputs.getSeries(name).toArray())
                            )
                    })
                    this.setState({ selectedMatrix, selectedMatWithDesiredOutputs, selectedMatWithoutDesiredOutputs, referenceValues });
                }
            }
        }
    }

    private getReferenceValues(name: string) {
        const { referenceValues } = this.state;
        if (referenceValues) {
            return referenceValues.at(name);
        }
    }

    private defaultCellWidth(id: number) {
        const width = [150, 100, 150];
        return width[id];
    }

    private async updateFeatures() {
        let { patientMeta, featureMeta, itemDicts, target } = this.props
        const subject_id = patientMeta?.subjectId;
        if (subject_id !== undefined) {
            const featureValues = await getFeatureValues({ subject_id });
            const shapValues = await getSHAPValues({ subject_id, target });
            const whatIfShapValues = await getWhatIfSHAPValues({ subject_id, target });
            // level-1: individual features
            const L1Features: IDataFrame<number, Feature> = featureMeta.select(row => {
                const { entityId, whereItem } = row;
                const whatifResults = whatIfShapValues(row['name']!);
                let alias = row.alias;
                // if (whereItem.length > 0) {
                //     const itemName = whereItem[1];
                //     const itemLabel = itemDicts && entityId && itemDicts(entityId, itemName!)?.LABEL;
                //     alias = `${row.alias}(${itemLabel || itemName})`
                // }
                return {
                    ...row,
                    alias,
                    value: featureValues(row['name']!),
                    contribution: shapValues(row['name']!),
                    contributionIfNormal: whatifResults && whatifResults.shap,
                    predictionIfNormal: whatifResults && whatifResults.prediction,
                };
            });
            // level-2: group-by item & period
            const individualFeatures = L1Features.where(row => row.whereItem.length == 0);
            const whereFeatures = L1Features.where(row => row.whereItem.length > 0);
            const groups = whereFeatures.groupBy(row => row.period + row.whereItem[1]).toArray();
            const groupedFeature: IDataFrame<number, Feature> = new DataFrame(groups.map(group => {
                const sample = group.first();
                const itemName = sample.whereItem![1] as string;
                const itemLabel = itemDicts && sample.entityId && itemDicts(sample.entityId, itemName)?.LABEL;
                const entityId = _.uniq(group.getSeries('entityId').toArray().filter(isDefined)).length > 1 ? undefined : sample.entityId;
                return {
                    ...sample,
                    name: 'g-' + _.reduce(group.getSeries('name').toArray(), (a, b) => `${a}-${b}`),
                    entityId: entityId,
                    alias: itemLabel || itemName,
                    value: undefined,
                    primitive: undefined,
                    contribution: _.sum(group.getSeries('contribution').toArray()),
                    contributionIfNormal: undefined,
                    children: group
                };
            }));
            const L2Features = individualFeatures.concat(groupedFeature);
            // level-3: group-by period
            const features = new DataFrame(L2Features.groupBy(row => row.type).toArray().map(group => {
                const sample = group.first();
                const entityId = _.uniq(group.getSeries('entityId').toArray().filter(isDefined)).length > 1 ? undefined : sample.entityId;
                return {
                    ...sample,
                    entityId: entityId,
                    name: 'g-' + _.reduce(group.getSeries('name').toArray(), (a, b) => `${a}-${b}`),
                    alias: sample.type,
                    value: undefined,
                    primitive: undefined,
                    contribution: _.sum(group.getSeries('contribution').toArray()),
                    contributionIfNormal: undefined,
                    children: group
                }
            }))
            this.setState({ features, shapValues: featureMeta.select(f => shapValues(f.name!)).toArray() })
        }
    }

    componentDidUpdate(prevProps: FeatureViewProps, prevState: FeatureViewStates) {
        const { groupIds, patientMeta, target } = this.props;
        if (prevState.featureMatrix != this.state.featureMatrix
            || prevProps.patientMeta?.subjectId !== patientMeta?.subjectId
            || prevProps.target !== target || !arrayShallowCompare(prevProps.groupIds, groupIds)) {
            this.updateFeatures();
            this.updateReferenceValues();
        }
    }

    public render() {
        const { target, tableNames, entityCategoricalColor, abnormalityColor, ...rest } = this.props;
        const { features, shapValues, selectedMatWithDesiredOutputs, selectedMatWithoutDesiredOutputs } = this.state;

        return (
            <div className="feature-view">
                {/* <div className="legend-container">
                    {entityCategoricalColor && <div className="category-legend-container">
                        <div className="legend-block">
                            <div className='legend-rect' style={{ backgroundColor: entityCategoricalColor(undefined) }} />
                            <span className='legend-name'>{"Patient Info & Surgery Info"}</span>
                        </div>
                        {tableNames && tableNames.map(name =>
                            <div className="legend-block" key={name}>
                                <div className='legend-rect' style={{ backgroundColor: entityCategoricalColor(name) }} />
                                <span className='legend-name'>{name.toLocaleLowerCase()}</span>
                            </div>
                        )}
                    </div>}
                    {abnormalityColor && <div className="abnormality-legend-container">
                        <span className="legend-anno">Normal</span>
                        <div className="legend-color-bar"
                            // style={{backgroundColor: `linear-gradient(${abnormalityColor(1)}, ${abnormalityColor(1.75)}, ${abnormalityColor(2.5)})`}}/>
                            style={{
                                backgroundImage: `linear-gradient( to right, ${abnormalityColor(1)}, ${abnormalityColor(1.75)}, 
                        ${abnormalityColor(2.5)})`
                            }} />
                        <span className="legend-anno">Abnormal</span>
                    </div>}
                </div> */}
                {/* <div className="feature-view-search">
                    <Search enterButton />
                </div>
                <Divider /> */}
                {features && <FeatureList
                    {...rest}
                    shapValues={shapValues}
                    features={features}
                    cellWidth={this.defaultCellWidth}
                    // selectedMatrix={selectedMatrix}
                    selectedMatWithDesiredOutputs={selectedMatWithDesiredOutputs}
                    selectedMatWithoutDesiredOutputs={selectedMatWithoutDesiredOutputs}
                    getReferenceValue={this.getReferenceValues}
                    entityCategoricalColor={entityCategoricalColor}
                    abnormalityColor={abnormalityColor}
                />}
            </div>
        )
    }
}

export interface FeatureListProps {
    className?: string,
    features: IDataFrame<number, Feature>,
    shapValues?: number[],
    prediction: number,
    cellWidth: (id: number) => number,
    entityCategoricalColor?: (entityName: string | undefined) => string,
    abnormalityColor?: (abnoramlity: number) => string,
    selectedMatrix?: IDataFrame<number, any>,
    selectedMatWithDesiredOutputs?: IDataFrame<number, any>,
    selectedMatWithoutDesiredOutputs?: IDataFrame<number, any>,
    getReferenceValue: (name: string) => (ReferenceValue | undefined),
    focusedFeatures: string[],
    display?: 'normal' | 'dense',

    inspectFeatureInSignal?: (feature: Feature) => void,
    inspectFeatureInTable?: (feature: Feature) => void,
}

type VFeature = {
    feature: Feature,
    show: boolean,
    children: VFeature[],
    parent?: VFeature,
}

function buildShowState(feature: Feature, parent?: VFeature): VFeature {
    const nodeState: VFeature = {
        feature: feature,
        show: false,
        parent: parent,
        children: feature.children?.select(f => buildShowState(f)).toArray() || []
    };
    return nodeState;
}

function extractSelfAndChildren(showState: VFeature): VFeature[] {
    return [showState, ..._.flatten(showState.children.map(f => extractSelfAndChildren(f)))];
}

function buildShowStateList(features: Feature[]): VFeature[] {
    const VFeatureTree: VFeature[] = features.map(f => buildShowState(f));
    for (const vfeature of VFeatureTree){
        vfeature.show = true;
    }
    const VFeatureList: VFeature[] = _.flatten(VFeatureTree.map(s => extractSelfAndChildren(s)));

    return VFeatureList;
}

export interface FeatureListStates {
    // Contribution sorting order
    order?: 'ascending' | 'dscending',
    threshold?: [number, number],
    VFeatureList: VFeature[],
}

export class FeatureList extends React.Component<FeatureListProps, FeatureListStates> {
    constructor(props: FeatureListProps) {
        super(props);

        this.state = { order: 'dscending', VFeatureList: buildShowStateList(props.features.toArray()) };

        this.onClick = this.onClick.bind(this);
        this.getContributions = this.getContributions.bind(this);
        this.sortFeatures = this.sortFeatures.bind(this);
        this.getContributionXScale = this.getContributionXScale.bind(this);
        this.flipShowState = this.flipShowState.bind(this);
    }

    private onClick(newOrder?: 'ascending' | 'dscending') {
        this.setState({ order: newOrder })
    }

    componentDidUpdate(prevProps: FeatureListProps){
        if (prevProps.features != this.props.features) {
            this.setState({VFeatureList: buildShowStateList(this.props.features.toArray())});
        }
    }

    // private getContributions(features: IDataFrame<number, Feature>, colName: string = 'contribution'): number[] {
    //     let contributions = features.getSeries(colName).toArray();
    //     for (const feature of features) {
    //         if (feature.children) {
    //             contributions = [...contributions, ...this.getContributions(feature.children)]
    //         }
    //     }
    //     return contributions
    // }
    private getContributions(features: VFeature[], colName: string = 'contribution'): number[] {
        let contributions = features.map(f => f.feature.contribution);
        return contributions
    }

    private flipShowState(feature: Feature) {
        const { VFeatureList } = this.state;
        // const VFeature = VFeatureList.find(d => d.feature === feature);
        // if (VFeature) {
        //     VFeature.show = !VFeature.show;
        //     VFeature.children.forEach(c => c.show = !c.show);
        // }
        for (const vFeature of VFeatureList) {
            if (vFeature.feature.name === feature.name){
                vFeature.show = !vFeature.show;
                vFeature.children.forEach(f => f.show = !f.show);
            }
        }
        console.log(VFeatureList.filter(d => d.show));
        this.setState({ VFeatureList });
    }

    private sortFeatures(features: IDataFrame<number, any>): IDataFrame<number, any> {
        const { order } = this.state;
        if (order === 'ascending')
            features = features.orderBy(row => row.contribution);
        else if (order == 'dscending')
            features = features.orderBy(row => -row.contribution);
        return features.select(feature => {
            if (feature.children) {
                return {
                    ...feature,
                    children: this.sortFeatures(feature.children)
                }
            }
            else return feature
        })
    }

    private getContributionXScale() {
        const { cellWidth } = this.props;
        const { VFeatureList } = this.state;
        const features = VFeatureList.filter(f => f.show);
        const contributions = this.getContributions(features, 'contribution').map(v => Math.abs(v));
        const whatIfContributions = this.getContributions(features, 'contributionIfNormal').map(v => Math.abs(v));
        const maxAbsCont = _.max([...contributions, ...whatIfContributions]) as number;
        console.log(maxAbsCont);
        return getScaleLinear(0, cellWidth(2), undefined, [-maxAbsCont, maxAbsCont]);
        // return getScaleLinear(0, cellWidth(2), contributions);
    }

    public render() {
        const { features, cellWidth, shapValues, ...rest } = this.props;
        const { order, threshold } = this.state;
        const sortedFeatures = this.sortFeatures(features);
        // shapValues && console.log([_.min(shapValues)!, _.sortBy(shapValues, d => d)[shapValues.length - 5]]);
        const shapMin = _.min(shapValues);
        const shapMax = _.max(shapValues);

        return <div style={{ width: "100%" }}>
            {/* <Search placeholder="input search text" style={{ marginLeft: 10, marginRight: 10, width: "90%" }} enterButton /> */}
            <div style={{ width: "100%" }}>
                <div className="feature-header">
                    <div className="feature-header-cell" style={{ width: cellWidth(0) }}>
                        <span>Name</span>
                        <Button type="text" className={'header-buttion'} icon={<SortAscendingOutlined />} />
                    </div>
                    <div className="feature-header-cell" style={{ width: cellWidth(1) }}>Value</div>
                    <div className="feature-header-cell" style={{ width: cellWidth(2) }}>
                        <span>Contribution</span>
                        {order === 'dscending' ? <Button type="text" className={'header-buttion'} icon={<ArrowDownOutlined />} onClick={this.onClick.bind(this, 'ascending')} />
                            : <Button type="text" className={'header-buttion'} icon={<ArrowUpOutlined />} onClick={this.onClick.bind(this, 'dscending')} />}
                        <Popover placement="right" content={<div>
                            {/* {shapValues && <Histogram
                                data={shapValues}
                                width={160}
                                height={40}
                                margin={0}
                                drawBottomAxis={false}
                                rangeSelector={'bin-wise'}
                                binColor={x => (x > 0) ? "#FF0155" : (x < 0) ? "#3C88E1" : "#fff"}
                                onSelectRange={(range: [number, number] | undefined) => this.setState({ threshold: range })}
                                // onSelectRange={(range: [number, number] | undefined) => console.log( range )}
                            // rectStyle={{strokeWidth: 1, stroke: '#eee'}}
                            />} */}
                            <div style={{ width: 160, height: 20 }} onMouseDown={(event) => event.stopPropagation()}>
                                {shapValues && <Slider
                                    range defaultValue={[_.sortBy(shapValues, d => d)[shapValues.length - 5], shapMax!]}
                                    min={shapMin!} max={shapMax!} step={(shapMax! - shapMin!) / 100}
                                    onAfterChange={(range) => this.setState({ threshold: range })}
                                />}
                            </div>
                        </div>} trigger="click">
                            <Button type="text" className={'header-buttion'} icon={<FilterOutlined />} />
                        </Popover>
                    </div>
                </div>
                <div className="feature-content">
                    {sortedFeatures?.toArray().map(row =>
                        <FeatureBlock
                            {...rest}
                            feature={row}
                            depth={0}
                            x={this.getContributionXScale()}
                            cellWidth={cellWidth}
                            key={row.name || row.alias}
                            threshold={threshold}
                            onCollapse={this.flipShowState}
                        />
                    )}
                </div>
            </div>
        </div>
    }
}

export interface FeatureBlockProps {
    className?: string,
    depth: number,
    feature: Feature,
    prediction: number,
    selectedMatrix?: IDataFrame<number, any>,
    selectedMatWithDesiredOutputs?: IDataFrame<number, any>,
    selectedMatWithoutDesiredOutputs?: IDataFrame<number, any>,
    getReferenceValue: (name: string) => (ReferenceValue | undefined),
    x: d3.ScaleLinear<number, number>,
    cellWidth: (id: number) => number,
    entityCategoricalColor?: (entityName: string | undefined) => string,
    abnormalityColor?: (abnoramlity: number) => string,
    focusedFeatures: string[],
    display?: 'normal' | 'dense',
    threshold?: [number, number],

    inspectFeatureInSignal?: (feature: Feature) => void,
    inspectFeatureInTable?: (feature: Feature) => void,
    onCollapse?: (feature: Feature) => void;
}
export interface FeatureBlockStates {
    collapsed: boolean,
    showDistibution: boolean,
    showWhatIf: boolean,
}

export class FeatureBlock extends React.Component<FeatureBlockProps, FeatureBlockStates> {
    constructor(props: FeatureBlockProps) {
        super(props);
        this.state = {
            collapsed: true,
            showDistibution: false,
            showWhatIf: false
        }

        this.onClickButton = this.onClickButton.bind(this);
        this.onClickDiv = this.onClickDiv.bind(this);
        this.hasFeature = this.hasFeature.bind(this);
    }

    componentDidUpdate(prevProps: FeatureBlockProps) {
        const { feature, focusedFeatures } = this.props;
        if (!arrayShallowCompare(prevProps.focusedFeatures, focusedFeatures)) {
            if (this.hasFeature(feature, focusedFeatures)) {
                this.setState({ collapsed: false });
            }
        }
    }

    private hasFeature(feature: Feature, featureNames: string[]): boolean {
        if (feature.name && featureNames.includes(feature.name))
            return true;
        if (feature.children?.where(row => this.hasFeature(row, featureNames)).count())
            return true;
        else
            return false
    }

    protected onClickButton() {
        const { onCollapse, feature } = this.props;
        this.setState({ collapsed: !this.state.collapsed });

        window.setTimeout(() => onCollapse && onCollapse(feature), 500);
    }

    protected onClickDiv() {
        this.setState({ showDistibution: !this.state.showDistibution });
    }

    render() {
        const { feature, x, cellWidth, entityCategoricalColor, abnormalityColor, inspectFeatureInSignal, inspectFeatureInTable,
            className, depth, selectedMatWithDesiredOutputs, selectedMatWithoutDesiredOutputs,
            focusedFeatures, getReferenceValue, display, prediction, threshold } = this.props;
        const { collapsed, showDistibution, showWhatIf } = this.state
        const { name, alias, value, contribution, children, entityId, predictionIfNormal } = feature;
        const referenceValue = feature.name ? getReferenceValue(feature.name) : undefined;

        // console.log('referenceValue', feature.name, referenceValue, value,)
        let outofRange: 'none' | 'low' | 'high' = 'none';
        let whatIfValue = undefined;
        let valueColor = '#fff';
        if (referenceValue && typeof (value) === typeof (0.0)) {
            const { mean, std, ci95 } = referenceValue;
            const rate = Math.abs((value as number - mean) / std);
            if (value as number > ci95[1]) {
                outofRange = 'high'
                whatIfValue = ci95[1]
            }
            else if (value as number < ci95[0]) {
                outofRange = 'low'
                whatIfValue = ci95[0]
            }
            if (abnormalityColor) {
                valueColor = abnormalityColor(rate);
            }
        }
        let showState: 'normal' | 'focused' | 'unfocused' | 'none' = 'normal';
        if (focusedFeatures.length > 0) {
            if (this.hasFeature(feature, focusedFeatures)) showState = 'focused';
            else showState = 'unfocused';
        }
        if (display && display === 'dense') {
            if (showState === 'unfocused') showState = 'none';
        }
        if (threshold) {
            // higher is allowed
            if (contribution < threshold[0])
                if (showState !== 'focused') showState = 'none';
        }

        // const heigth = collapsed ? (showDistibution ? 80 : 30) : 8;
        const heigth = showDistibution ? 80 : 30;
        const isLeaf = !feature.children || feature.children.count() === 0;

        let id: string | undefined = undefined
        if (isLeaf)
            id = `${className}-${feature.name}`;
        else if (collapsed) {
            const childrenNames = feature.children?.getSeries('name').where(d => d);
            if (childrenNames && childrenNames.count()) {
                // id = _.reduce(childrenNames.toArray().map(n => `${className}-${n} `), (a, b) => a.concat(b));
                id = `${className}-${childrenNames.first()}`;
            }
        }

        return <div>
            <div className="feature-row" style={{
                display: (showState === 'none') ? "none" : "flex", justifyContent: "flex-end", position: "relative",
                width: `calc(100% - ${depth * 10}px)`, left: `${depth * 10}px`
            }}>
                <div style={{ width: 20 }}>
                    {children && <CaretRightOutlined className="right-button"
                        onClick={this.onClickButton} rotate={collapsed ? 0 : 90} />}
                </div>
                <div className={`feature-block ${showState}` + ((depth === 0) ? " feature-top-block" : ""
                    + collapsed ? "" : " expanded"
                )}
                    id={id}
                    style={{
                        height: heigth, borderRightWidth: 4,
                        borderRightColor: entityCategoricalColor && entityCategoricalColor(entityId)
                    }}
                    onClick={children ? this.onClickButton : this.onClickDiv}>
                    <div className={`feature-block-inner`}>
                        <Tooltip title={alias}>
                            <div className="feature-block-cell feature-name" style={{ width: cellWidth(0) - 10 * depth }}>
                                <span className={"feature-block-cell-text"}>{showDistibution ? alias : beautifulPrinter(alias, 22)}</span>
                            </div>
                        </Tooltip>
                        <div className={"feature-block-cell" + (isLeaf ? " feature-value" : "")}
                            style={{ width: showDistibution ? cellWidth(1) + 40 : cellWidth(1), backgroundColor: valueColor }}>
                            {showDistibution ? <Histogram
                                // allData={selectedMatrix?.getSeries(name).toArray() as number[]}
                                data={[selectedMatWithDesiredOutputs?.getSeries(name!).toArray(),
                                selectedMatWithoutDesiredOutputs?.getSeries(name!).toArray()] as number[][]}
                                // data={selectedMatWithDesiredOutputs?.getSeries(name).toArray() as number[]}
                                height={70}
                                width={cellWidth(1) + 40}
                                drawLeftAxis={false}
                                drawBottomAxis={true}
                                areaChart={true}
                                margin={{ left: 10, bottom: 15 }}
                                referenceValue={value as number}
                                whatIfValue={showWhatIf ? whatIfValue : undefined}
                                mode="side-by-side"
                            /> : <Tooltip title={typeof (value) == typeof (0.0) ? beautifulPrinter(value) : value}>
                                <span className={"feature-block-cell-text"}>
                                    {outofRange === 'low' && <ArrowDownOutlined />}
                                    {beautifulPrinter(value)}
                                    {outofRange === 'high' && <ArrowUpOutlined />}
                                </span>
                            </Tooltip>}
                        </div>
                        <div className={"feature-block-cell feature-contribution"} style={{ width: cellWidth(2) }}
                        // onClick={() => this.setState({ showWhatIf: !showWhatIf })}
                        >
                            <div>
                                {/* {SHAPContributions({ feature, x, showWhatIf, height: 14, rectStyle: { opacity: !collapsed ? 0.3 : undefined } })} */}
                                {SHAPContributions({
                                    feature, x, showWhatIf, height: 14,
                                    posRectStyle: { fill: !collapsed ? '#f8a3bf' : undefined },
                                    negRectStyle: { fill: !collapsed ? '#9abce4' : undefined }
                                })}
                                {(contribution > x.domain()[1]) && <ArrowRightOutlined className="overflow-notation-right"/>}
                                {(contribution < x.domain()[0]) && <ArrowLeftOutlined className="overflow-notation-left"/>}
                            </div>
                            {/* {showWhatIf && whatIfValue && <div className={"what-if-content"}>
                                <span> After {(whatIfValue > (value as number))?'inceasing':'decreasing'} to {beautifulPrinter(whatIfValue)}</span>
                            </div>} */}
                            {showWhatIf && predictionIfNormal && whatIfValue && <div className={"what-if-label"}>
                                <div className={"label-circle"} style={{ backgroundColor: defaultCategoricalColor(Math.round(prediction)) }}>
                                    {prediction > 0.5 ? 'Has C.' : 'No C.'}
                                </div>
                                <ArrowRightOutlined />
                                <div className={"label-circle"} style={{ backgroundColor: defaultCategoricalColor(Math.round(predictionIfNormal)) }}>
                                    {predictionIfNormal > 0.5 ? 'Has C.' : 'No C.'}
                                </div>
                            </div>}
                        </div>
                    </div>
                </div>
                {(isLeaf || collapsed) && <span className={`feature-block-annote ${showState}`} style={{
                    backgroundColor: entityCategoricalColor && entityCategoricalColor(entityId),
                    height: heigth
                }} />}
                <Button size="small" type="primary" shape="circle"
                    icon={<LineChartOutlined />} onClick={() => inspectFeatureInSignal && inspectFeatureInSignal(feature)}
                    className={"feature-button-linechart"}
                />
                <Button size="small" type="primary" shape="circle"
                    icon={<TableOutlined />} onClick={() => inspectFeatureInTable && inspectFeatureInTable(feature)}
                    className={"feature-button-table"}
                />
                {showDistibution && isLeaf && outofRange !== 'none' && <Button size="small" type="primary" shape="circle"
                    icon={<QuestionOutlined />} onClick={() => this.setState({ showWhatIf: !showWhatIf })}
                    className={"feature-button-what-if"}
                />}

            </div>

            {(!collapsed) && children?.toArray().map(feature =>
                <FeatureBlock
                    {...this.props}
                    key={feature.name || `${feature.period}-${feature.entityId}-${feature.alias}`}
                    depth={depth + 1}
                    feature={feature}
                />)}
        </div>
    }
}

const SHAPContributions = (params: {
    feature: Feature,
    x: d3.ScaleLinear<number, number>,
    showWhatIf: boolean,
    height: number,
    posRectStyle?: React.CSSProperties,
    negRectStyle?: React.CSSProperties
}) => {
    const { feature, x, height, posRectStyle, negRectStyle, showWhatIf } = params;
    const cont = feature.contribution;
    const whatifcont = feature.contributionIfNormal;
    const posSegValue = _.range(0, 3).fill(0);
    const negSegValue = _.range(0, 3).fill(0);
    const width = x.range()[1] - x.range()[0];
    console.log(x.domain());
    if (cont > 0) posSegValue[0] = cont;
    else negSegValue[0] = -cont;
    if (whatifcont !== undefined && showWhatIf) {
        // positive common segments: a & b
        posSegValue[0] = (cont >= 0 && whatifcont >= 0) ? Math.min(cont, whatifcont) : 0;
        // positive differences: a - b
        posSegValue[1] = (cont >= 0) ? Math.max(0, cont - Math.max(0, whatifcont)) : 0;
        // positive differences: b - a
        posSegValue[2] = (whatifcont >= 0) ? Math.max(0, whatifcont - Math.max(0, cont)) : 0;

        // negative common segments: a & b
        negSegValue[0] = (cont < 0 && whatifcont <= 0) ? Math.min((-cont), (-whatifcont)) : 0;
        // negative differences: a - b
        negSegValue[1] = (cont < 0) ? Math.max(0, (-cont) - Math.max(0, (-whatifcont))) : 0;
        // negative differences: b - a
        negSegValue[2] = (whatifcont < 0) ? Math.max(0, (-whatifcont) - Math.max(0, (-cont))) : 0;
    }
    return <svg className={"contribution-svg"} height={height + 4}>
        <rect className="contribution-background" width={width} height={height + 2} x={x.range()[0]} y={0} />
        {negSegValue[0] > 0 && <rect className="neg-feature a-and-b" style={negRectStyle}
            width={x(negSegValue[0]) - x(0)} y={1} height={height} transform={`translate(${x(-negSegValue[0])}, 0)`} />}
        {negSegValue[1] > 0 && <rect className="neg-feature a-sub-b" style={negRectStyle}
            width={x(negSegValue[1]) - x(0)} y={1} height={height} transform={`translate(${x(-negSegValue[1] - negSegValue[0])}, 0)`} />}
        {negSegValue[2] > 0 && <rect className="neg-feature b-sub-a" style={negRectStyle}
            width={x(negSegValue[2]) - x(0)} y={1} height={height} transform={`translate(${x(-negSegValue[2] - negSegValue[0])}, 0)`} />}

        {posSegValue[0] > 0 && <rect className="pos-feature a-and-b" style={posRectStyle}
            width={x(posSegValue[0]) - x(0)} y={1} height={height} transform={`translate(${x(0)}, 0)`} />}
        {posSegValue[1] > 0 && <rect className="pos-feature a-sub-b" style={posRectStyle}
            width={x(posSegValue[1]) - x(0)} y={1} height={height} transform={`translate(${x(posSegValue[0])}, 0)`} />}
        {posSegValue[2] > 0 && <rect className="pos-feature b-sub-a" style={posRectStyle}
            width={x(posSegValue[2]) - x(0)} y={1} height={height} transform={`translate(${x(posSegValue[0])}, 0)`} />}
        <defs>
            <pattern id="pattern-stripe"
                width="4" height="4"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)">
                <rect width="2" height="4" transform="translate(0,0)" fill="white"></rect>
            </pattern>
            <mask id="mask-stripe">
                <rect x="0" y="0" width="100%" height="100%" fill="url(#pattern-stripe)" />
            </mask>
        </defs>
    </svg>
}
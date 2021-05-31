import { Feature, FeatureSchema } from "data/feature";
import { PatientStatics } from "data/patient";
import * as React from "react";
import * as d3 from "d3";
import { Button, Tooltip, Popover, Slider } from "antd"
import API from "router/api";
import { DataFrame, IDataFrame, fromCSV } from "data-forge";
import * as _ from "lodash"
import { getScaleLinear, beautifulPrinter, defaultCategoricalColor } from "visualization/common";
import {
    ArrowDownOutlined, ArrowLeftOutlined, ArrowRightOutlined, ArrowUpOutlined, CaretRightOutlined,
    FilterOutlined, LineChartOutlined, QuestionOutlined, SortAscendingOutlined, TableOutlined
} from "@ant-design/icons"
import { AggrValues, ItemDict, ReferenceValues } from "data/entity";
import AreaChart from "visualization/AreaChart";
import { arrayShallowCompare, getReferenceValue, isDefined } from "data/common";

import "./index.scss"
import { SHAPContributions } from "./SHAPBand";
import BarChart from "visualization/BarChart";

export interface FeatureViewProps {
    featureMeta: IDataFrame<number, FeatureSchema>,
    target: string,
    prediction: number,
    focusedFeatures: string[],
    className?: string,
    patientStatics: PatientStatics,
    selectedIds?: number[],
    entityCategoricalColor?: (entityName: string | undefined) => string,
    display?: 'normal' | 'dense',

    inspectFeatureInSignal?: (feature: Feature) => void,
    inspectFeatureInTable?: (feature: Feature) => void,
}

export interface FeatureViewStates {
    featureDisplayValues?: DataFrame,
    features?: IDataFrame<number, Feature>,
    shapValues?: number[],
    featureMatrix?: IDataFrame<number, any>,
    selectedMatrix?: IDataFrame<number, any>,
    selectedMatWithDesiredOutputs?: IDataFrame<number, any>,
    selectedMatWithoutDesiredOutputs?: IDataFrame<number, any>,
    referenceValues?: IDataFrame<string, ReferenceValues>,
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
        const featureMatrix = fromCSV(await API.featureValues.all(), { dynamicTyping: true })
            .setIndex('SUBJECT_ID');
        this.setState({ featureMatrix });
    }

    // run when the group ids updates
    private updateReferenceValues() {
        const { featureMeta, selectedIds } = this.props;
        const { featureMatrix } = this.state;
        if (featureMatrix) {
            const featureNames = featureMeta.getSeries('name').toArray() as string[];
            const selectedVectors = selectedIds && selectedIds.map(id => featureMatrix.at(id));
            if (selectedVectors?.length == 0) {
                alert("No patient in the selection.");
            }
            else if (selectedVectors) {
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
                    this.setState({ selectedMatrix, selectedMatWithDesiredOutputs, selectedMatWithoutDesiredOutputs });
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
        let { patientStatics: patientMeta, featureMeta, target } = this.props
        console.log(patientMeta.SUBJECT_ID);
        const subjectId = patientMeta.SUBJECT_ID;
        const featureValues = await API.featureValues.find(subjectId);
        const shapValues = await API.shapValues.find(subjectId, {}, { target });
        const whatIfShapValues = await API.cfShapValues.find(subjectId, {}, { target });
        // level-1: individual features
        const L1Features: IDataFrame<number, Feature> = featureMeta.select(row => {
            const whatifResults = whatIfShapValues && whatIfShapValues[row['id']!];
            let alias = row.alias;
            return {
                ...row,
                alias,
                value: featureValues ? featureValues[row['id']!] : 0,
                contribution: shapValues ? shapValues[row['id']!] : 0,
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
            // const itemLabel = itemDicts && sample.entityId && itemDicts(sample.entityId, itemName)?.LABEL;
            const entityId = _.uniq(group.getSeries('entityId').toArray().filter(isDefined)).length > 1 ? undefined : sample.entityId;
            return {
                ...sample,
                name: 'g-' + _.reduce(group.getSeries('name').toArray(), (a, b) => `${a}-${b}`),
                entityId: entityId,
                // alias: itemLabel || itemName,
                alias: itemName,
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
        console.log(features);
        this.setState({ features, shapValues: featureMeta.select(f => shapValues ? shapValues[f.id!] : 0).toArray() })
    }

    componentDidUpdate(prevProps: FeatureViewProps, prevState: FeatureViewStates) {
        const { selectedIds: groupIds, patientStatics: patientMeta, target } = this.props;
        if (prevState.featureMatrix != this.state.featureMatrix
            || prevProps.patientStatics?.SUBJECT_ID !== patientMeta?.SUBJECT_ID
            || prevProps.target !== target || !arrayShallowCompare(prevProps.selectedIds, groupIds)) {
            this.updateFeatures();
            this.updateReferenceValues();
        }
    }

    public render() {
        const { target, entityCategoricalColor, ...rest } = this.props;
        const { features, shapValues, selectedMatWithDesiredOutputs, selectedMatWithoutDesiredOutputs } = this.state;
        const contextFeatureValues = [];
        if (selectedMatWithDesiredOutputs) contextFeatureValues.push(selectedMatWithDesiredOutputs);
        if (selectedMatWithoutDesiredOutputs) contextFeatureValues.push(selectedMatWithoutDesiredOutputs);

        return (
            <div className="feature-view">
                {features && <FeatureList
                    {...rest}
                    shapValues={shapValues}
                    features={features}
                    cellWidth={this.defaultCellWidth}
                    contextFeatureValues={contextFeatureValues}
                    // getReferenceValue={this.getReferenceValues}
                    entityCategoricalColor={entityCategoricalColor}
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
    contextFeatureValues: IDataFrame<number, any>[],
    getReferenceValue?: (name: string) => (AggrValues | undefined),
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
    for (const vfeature of VFeatureTree) {
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

    componentDidUpdate(prevProps: FeatureListProps) {
        if (prevProps.features != this.props.features) {
            this.setState({ VFeatureList: buildShowStateList(this.props.features.toArray()) });
        }
    }

    private getContributions(features: VFeature[], colName: string = 'contribution'): number[] {
        let contributions = features.map(f => f.feature.contribution);
        return contributions
    }

    private flipShowState(feature: Feature) {
        const { VFeatureList } = this.state;
        for (const vFeature of VFeatureList) {
            if (vFeature.feature.id === feature.id) {
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
        return getScaleLinear(0, cellWidth(2), undefined, [-maxAbsCont, maxAbsCont]);
        // return getScaleLinear(0, cellWidth(2), contributions);
    }

    public render() {
        const { features, cellWidth, shapValues, ...rest } = this.props;
        const { order, threshold } = this.state;
        const sortedFeatures = this.sortFeatures(features);
        const shapMin = _.min(shapValues);
        const shapMax = _.max(shapValues);

        return <div style={{ width: "100%" }}>
            <div style={{ width: "100%" }}>
                <div className="feature-header">
                    <div className="feature-header-cell" style={{ width: cellWidth(0) }}>
                        <span>Name</span>
                        <Button type="text" className={'header-buttion'} icon={<SortAscendingOutlined />} />
                    </div>
                    <div className="feature-header-cell" style={{ width: cellWidth(1) }}><
                        span>Contribution</span>
                    </div>
                    <div className="feature-header-cell" style={{ width: cellWidth(2) }}>
                        <span>Contribution</span>
                        {order === 'dscending' ?
                            <Button type="text" className={'header-buttion'} icon={<ArrowDownOutlined />}
                                onClick={this.onClick.bind(this, 'ascending')} />
                            : <Button type="text" className={'header-buttion'} icon={<ArrowUpOutlined />}
                                onClick={this.onClick.bind(this, 'dscending')} />}
                        <Popover placement="right" content={
                            <div style={{ width: 160, height: 20 }} onMouseDown={(event) => event.stopPropagation()}>
                                {shapValues && <Slider
                                    tipFormatter={null}
                                    range defaultValue={[_.sortBy(shapValues, d => d)[shapValues.length - 5], shapMax!]}
                                    min={shapMin!} max={shapMax!} step={(shapMax! - shapMin!) / 100}
                                    onAfterChange={(range) => this.setState({ threshold: range })}
                                />}
                            </div>
                        } trigger="click">
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
    contextFeatureValues: IDataFrame<number, any>[],
    getReferenceValue?: (name: string) => (AggrValues | undefined),
    x: d3.ScaleLinear<number, number>,
    cellWidth: (id: number) => number,
    entityCategoricalColor?: (entityName: string | undefined) => string,
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
                // this.setState({ collapsed: false });
            }
        }
    }

    private hasFeature(feature: Feature, featureNames: string[]): boolean {
        if (feature.id && featureNames.includes(feature.id))
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
        const { feature, x, cellWidth, entityCategoricalColor, inspectFeatureInSignal, inspectFeatureInTable,
            className, depth, contextFeatureValues, focusedFeatures, getReferenceValue, display,
            prediction, threshold } = this.props;
        const { collapsed, showDistibution, showWhatIf } = this.state
        const { id: name, alias, value, contribution, children, entityId, predictionIfNormal } = feature;
        // const referenceValue = feature.id ? getReferenceValue(feature.id) : undefined;
        const referenceValue = undefined;

        // console.log('referenceValue', feature.name, referenceValue, value,)
        let outofRange: 'none' | 'low' | 'high' = 'none';
        let whatIfValue = undefined;
        if (referenceValue && typeof (value) === typeof (0.0)) {
            const { ci95 } = referenceValue;
            if (value as number > ci95[1]) {
                outofRange = 'high'
                whatIfValue = ci95[1]
            }
            else if (value as number < ci95[0]) {
                outofRange = 'low'
                whatIfValue = ci95[0]
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

        const heigth = showDistibution ? 80 : 30;
        const isLeaf = !feature.children || feature.children.count() === 0;

        let id: string | undefined = undefined
        if (isLeaf)
            id = `${className}-${feature.id}`;
        else if (collapsed) {
            const childrenNames = feature.children?.getSeries('name').where(d => d);
            if (childrenNames && childrenNames.count()) {
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
                <div className={`feature-block ${showState}` + (collapsed ? "" : " expanded")}
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
                            style={{ width: showDistibution ? cellWidth(1) + 40 : cellWidth(1) }}>
                            {showDistibution ?
                                (typeof (value) === 'number') ? <AreaChart
                                    data={contextFeatureValues?.map(mat => mat.getSeries(name).toArray()) as number[][]}
                                    height={70}
                                    width={cellWidth(1) + 40}
                                    drawBottomAxis={true}
                                    margin={{ left: 10, bottom: 20 }}
                                    referenceValue={value as number}
                                    whatIfValue={showWhatIf ? whatIfValue : undefined}
                                    mode="side-by-side"
                                /> : (typeof (value) === 'string') ? <BarChart
                                    data={contextFeatureValues?.map(mat => mat.getSeries(name).toArray()) as string[][]}
                                    height={70}
                                    width={cellWidth(1) + 40}
                                    drawBottomAxis={true}
                                    margin={{ left: 10, bottom: 20 }}
                                    // referenceValue={value}
                                    // whatIfValue={showWhatIf ? whatIfValue : undefined}
                                    mode="side-by-side"
                                /> : <div />
                                : <Tooltip title={typeof (value) == typeof (0.0) ? beautifulPrinter(value) : value}>
                                    <span className={"feature-block-cell-text"}>
                                        {outofRange === 'low' && <ArrowDownOutlined />}
                                        {beautifulPrinter(value)}
                                        {outofRange === 'high' && <ArrowUpOutlined />}
                                    </span>
                                </Tooltip>}
                        </div>
                        <div className={"feature-block-cell feature-contribution"} style={{ width: cellWidth(2) }}>
                            {SHAPContributions({
                                contribution: feature.contribution, contributionIfNormal: feature.contributionIfNormal, x, height: 14,
                                posRectStyle: { fill: !collapsed ? '#f8a3bf' : undefined },
                                negRectStyle: { fill: !collapsed ? '#9abce4' : undefined }
                            })}
                            {(contribution > x.domain()[1]) && <ArrowRightOutlined className="overflow-notation-right" />}
                            {(contribution < x.domain()[0]) && <ArrowLeftOutlined className="overflow-notation-left" />}
                            {showWhatIf && predictionIfNormal && whatIfValue && <div className={"what-if-label"}>
                                <div className={"label-circle"} style={{ backgroundColor: defaultCategoricalColor(Math.round(prediction)) }}>
                                    {prediction > 0.5 ? 'High' : 'Low'}
                                </div>
                                <ArrowRightOutlined />
                                <div className={"label-circle"} style={{ backgroundColor: defaultCategoricalColor(Math.round(predictionIfNormal)) }}>
                                    {predictionIfNormal > 0.5 ? 'High' : 'Low'}
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
                    key={feature.id || `${feature.period}-${feature.entityId}-${feature.alias}`}
                    depth={depth + 1}
                    feature={feature}
                />)}
        </div>
    }
}
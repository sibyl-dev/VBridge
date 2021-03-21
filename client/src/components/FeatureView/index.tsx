import { Feature, FeatureMeta } from "data/feature";
import { PatientMeta } from "data/patient";
import * as React from "react";
import * as d3 from "d3";
import { Button, Divider, Tooltip, Input } from "antd"
import { getFeatureMatrix, getFeatureValues, getSHAPValues, getWhatIfSHAPValues } from "router/api";
import { DataFrame, IDataFrame } from "data-forge";
import * as _ from "lodash"
import { getScaleLinear, beautifulPrinter } from "visualization/common";
import {
    ArrowDownOutlined, ArrowUpOutlined, CaretRightOutlined, LineChartOutlined,
    SortAscendingOutlined, TableOutlined
} from "@ant-design/icons"
import { ItemDict } from "data/table";
import Histogram from "visualization/Histogram";
import { arrayShallowCompare, getReferenceValue, ReferenceValue } from "data/common";

import "./index.scss"

export interface FeatureViewProps {
    className?: string,
    patientMeta?: PatientMeta,
    tableNames?: string[],
    featureMeta: IDataFrame<number, FeatureMeta>,
    predictionTargets: string[],
    groupIds?: number[],
    itemDicts?: ItemDict,
    entityCategoricalColor?: (entityName: string | undefined) => string,
    abnormalityColor?: (abnoramlity: number) => string,
    focusedFeatures: string[],
    display?: 'normal' | 'dense',
    inspectFeature?: (feature: Feature) => void,
    target: string,
}

export interface FeatureViewStates {
    featureDisplayValues?: DataFrame,
    features?: IDataFrame<number, Feature>,
    featureMatrix?: IDataFrame<number, any>,
    referenceValues?: IDataFrame<string, ReferenceValue>,
}

export default class FeatureView extends React.Component<FeatureViewProps, FeatureViewStates> {

    constructor(props: FeatureViewProps) {
        super(props);

        this.state = {};
        this.defaultCellWidth = this.defaultCellWidth.bind(this);
        this.getReferenceValues = this.getReferenceValues.bind(this);
    }

    componentDidMount() {
        this.loadFeatureMatAndRefs();
        this.updateFeatures();
    }

    private async loadFeatureMatAndRefs() {
        const { featureMeta } = this.props;
        const featureMatrix = await getFeatureMatrix();
        const featureNames = featureMeta.getSeries('name').toArray() as string[];
        const referenceValues = new DataFrame({
            index: featureNames,
            values: featureNames.map(name => getReferenceValue(featureMatrix.getSeries(name).parseFloats().toArray()))
        })
        this.setState({ featureMatrix, referenceValues });
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
        console.log('updateFeatures', target)
        const subject_id = patientMeta?.subjectId;
        if (subject_id !== undefined) {
            const featureValues = await getFeatureValues({ subject_id });
            const shapValues = await getSHAPValues({ subject_id, target });
            const whatIfShapValues = await getWhatIfSHAPValues({ subject_id, target });
            // level-1: individual features
            const L1Features: IDataFrame<number, Feature> = featureMeta.select(row => {
                return {
                    ...row,
                    value: featureValues(row['name']!),
                    contribution: shapValues(row['name']!),
                    contributionIfNormal: whatIfShapValues(row['name']!)
                };
            });
            // level-2: group-by item
            const individualFeatures = L1Features.where(row => row.whereItem.length == 0);
            const whereFeatures = L1Features.where(row => row.whereItem.length > 0);
            const groups = whereFeatures.groupBy(row => row.whereItem[1]).toArray();
            const groupedFeature: IDataFrame<number, Feature> = new DataFrame(groups.map(group => {
                const sample = group.first();
                const itemName = sample.whereItem![1] as string;
                const itemLabel = itemDicts && sample.entityId && itemDicts(sample.entityId, itemName)?.LABEL;
                return {
                    ...sample,
                    name: _.reduce(group.getSeries('name').toArray(), (a, b) => `${a}-${b}`),
                    alias: itemLabel || itemName,
                    value: undefined,
                    primitive: undefined,
                    contribution: _.sum(group.getSeries('contribution').toArray()),
                    contributionIfNormal: undefined,
                    children: group
                };
            }));
            // level-3: group-by period
            const L2Features = individualFeatures.concat(groupedFeature);
            const features = new DataFrame(L2Features.groupBy(row => row.type).toArray().map(group => {
                const sample = group.first();
                return {
                    ...sample,
                    name: _.reduce(group.getSeries('name').toArray(), (a, b) => `${a}-${b}`),
                    alias: sample.type,
                    value: undefined,
                    primitive: undefined,
                    contribution: _.sum(group.getSeries('contribution').toArray()),
                    contributionIfNormal: undefined,
                    children: group
                }
            }))
            this.setState({ features })
        }
    }

    componentDidUpdate(prevProps: FeatureViewProps, prevState: FeatureViewStates) {
        if (prevProps.patientMeta?.subjectId !== this.props.patientMeta?.subjectId
            || prevProps.target !== this.props.target) {
            this.updateFeatures();
        }
    }

    public render() {
        const { predictionTargets, target, tableNames, entityCategoricalColor, abnormalityColor, ...rest } = this.props;
        const { features, featureMatrix } = this.state;

        return (
            <div className="feature-view">
                <div className="legend-container">
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
                        style={{backgroundImage: `linear-gradient( to right, ${abnormalityColor(1)}, ${abnormalityColor(1.75)}, 
                        ${abnormalityColor(2.5)})`}}/>
                        <span className="legend-anno">Abnormal</span>
                    </div>}
                </div>
                <Divider />
                {features && <FeatureList
                    {...rest}
                    features={features}
                    cellWidth={this.defaultCellWidth}
                    featureMatrix={featureMatrix}
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
    cellWidth: (id: number) => number,
    entityCategoricalColor?: (entityName: string | undefined) => string,
    abnormalityColor?: (abnoramlity: number) => string,
    featureMatrix?: IDataFrame<number, any>,
    getReferenceValue: (name: string) => (ReferenceValue | undefined),
    focusedFeatures: string[],
    display?: 'normal' | 'dense',

    inspectFeature?: (feature: Feature) => void,
}

export interface FeatureListStates {
    // Contribution sorting order
    order?: 'ascending' | 'dscending',
}

export class FeatureList extends React.Component<FeatureListProps, FeatureListStates> {
    constructor(props: FeatureListProps) {
        super(props);

        this.state = { order: 'dscending' };

        this.onClick = this.onClick.bind(this);
        this.getContributions = this.getContributions.bind(this);
        this.sortFeatures = this.sortFeatures.bind(this);
        this.getContributionXScale = this.getContributionXScale.bind(this);
    }

    private onClick(newOrder?: 'ascending' | 'dscending') {
        this.setState({ order: newOrder })
    }

    private getContributions(features: IDataFrame<number, Feature>, colName: string = 'contribution'): number[] {
        let contributions = features.getSeries(colName).toArray();
        for (const feature of features) {
            if (feature.children) {
                contributions = [...contributions, ...this.getContributions(feature.children)]
            }
        }
        return contributions
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
        const { features, cellWidth } = this.props;
        const contributions = this.getContributions(features, 'contribution').map(v => Math.abs(v));
        const whatIfContributions = this.getContributions(features, 'contributionIfNormal').map(v => Math.abs(v));
        const maxAbsCont = _.max([...contributions, ...whatIfContributions]) as number;
        return getScaleLinear(0, cellWidth(2), undefined, [-maxAbsCont, maxAbsCont]);
    }

    public render() {
        const { features, cellWidth, ...rest } = this.props;
        const { order } = this.state;
        const sortedFeatures = this.sortFeatures(features);

        return <div style={{ width: "100%" }}>
            {/* <Search placeholder="input search text" style={{ marginLeft: 10, marginRight: 10, width: "90%" }} enterButton /> */}
            <div style={{ width: "100%" }}>
                <div className="feature-header">
                    <div className="feature-header-cell" style={{ width: cellWidth(0) }}>
                        <span>Name</span>
                        <SortAscendingOutlined />
                    </div>
                    <div className="feature-header-cell" style={{ width: cellWidth(1) }}>Value</div>
                    <div className="feature-header-cell" style={{ width: cellWidth(2) }}>
                        <span>Contribution</span>
                        {order === 'dscending' ? <ArrowDownOutlined onClick={this.onClick.bind(this, 'ascending')} />
                            : <ArrowUpOutlined onClick={this.onClick.bind(this, 'dscending')} />}
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
    featureMatrix?: IDataFrame<number, any>,
    getReferenceValue: (name: string) => (ReferenceValue | undefined),
    x: d3.ScaleLinear<number, number>,
    cellWidth: (id: number) => number,
    entityCategoricalColor?: (entityName: string | undefined) => string,
    abnormalityColor?: (abnoramlity: number) => string,
    focusedFeatures: string[],
    display?: 'normal' | 'dense',

    inspectFeature?: (feature: Feature) => void,
}
export interface FeatureBlockStates {
    collapsed: boolean,
    showDistibution: boolean
}

export class FeatureBlock extends React.Component<FeatureBlockProps, FeatureBlockStates> {
    constructor(props: FeatureBlockProps) {
        super(props);
        this.state = {
            collapsed: true,
            showDistibution: false
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
        this.setState({ collapsed: !this.state.collapsed });
    }

    protected onClickDiv() {
        this.setState({ showDistibution: !this.state.showDistibution });
    }

    render() {
        const { feature, x, cellWidth, entityCategoricalColor, abnormalityColor, inspectFeature,
            className, depth, featureMatrix, focusedFeatures, getReferenceValue, display } = this.props;
        const { collapsed, showDistibution } = this.state
        const { name, alias, value, contribution, children, entityId } = feature;
        const referenceValue = feature.name && getReferenceValue(feature.name);
        // const series = featureMatrix?.getSeries(name).parseFloats().toArray();

        let valueColor = '#fff';
        let outofRange = undefined;
        if (referenceValue && typeof (value) === typeof (0.0) && abnormalityColor) {
            const { mean, std, ci95 } = referenceValue;
            const rate = Math.abs((value as number - mean) / std);
            valueColor = abnormalityColor(rate);
            if (value as number > ci95[1])
                outofRange = 1
            else if (value as number < ci95[0])
                outofRange = 0
        }
        let showState: 'normal' | 'focused' | 'unfocused' | 'none' = 'normal';
        if (focusedFeatures.length > 0) {
            if (this.hasFeature(feature, focusedFeatures)) showState = 'focused';
            else showState = 'unfocused';
        }
        if (display && display === 'dense') {
            if (showState === 'unfocused') showState = 'none';
        }
        const heigth = showDistibution ? 100 : 30;

        let id: string | undefined = undefined
        if (!feature.children || feature.children.count() === 0)
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
                <div className={`feature-block ${showState}` + ((depth === 0) ? " feature-top-block" : "")}
                    id={id}
                    style={{
                        height: heigth, borderRightWidth: 4,
                        borderRightColor: entityCategoricalColor && entityCategoricalColor(entityId)
                    }}
                    onClick={children ? this.onClickButton : this.onClickDiv}>
                    <div className={`feature-block-inner`}>
                        <Tooltip title={alias}>
                            <div className="feature-block-cell feature-name" style={{ width: cellWidth(0) - 10 * depth }}>
                                <span className={"feature-block-cell-text"}>{beautifulPrinter(alias, 25)}</span>
                            </div>
                        </Tooltip>
                        <Tooltip title={typeof (value) == typeof (0.0) ? beautifulPrinter(value) : value}>
                            <div className={"feature-block-cell feature-value"}
                                style={{ width: cellWidth(1), backgroundColor: valueColor }}>
                                <span className={"feature-block-cell-text"}>{beautifulPrinter(value)}
                                    {outofRange && outofRange == 0 ? <ArrowDownOutlined /> : ''}
                                    {outofRange && outofRange == 1 ? <ArrowUpOutlined /> : ''}

                                </span>
                            </div>
                        </Tooltip>
                        {paintContributions({
                            feature, x,
                            className: "feature-block-cell feature-contribution",
                            style: { width: cellWidth(2), opacity: Math.max(1 - 0.3 * depth, 0.5) }
                        })}
                    </div>
                    {(typeof (value) === typeof (0.0)) && showDistibution && name &&
                        <div className="feature-block-hist">
                            <Histogram
                                data={featureMatrix?.getSeries(name).parseFloats().toArray() as number[]}
                                height={60}
                                width={cellWidth(1) + 20}
                                drawAxis={false}
                                margin={{ left: 10, bottom: 15 }}
                                referenceValue={value as number}
                            />
                        </div>}
                </div>
                <span className={`feature-block-annote ${showState}`} style={{
                    backgroundColor: entityCategoricalColor && entityCategoricalColor(entityId),
                    height: heigth
                }} />
                <Button size="small" type="primary" shape="circle"
                    icon={<LineChartOutlined />} onClick={() => inspectFeature && inspectFeature(feature)}
                    className={"feature-button-linechart"}
                />
                <Button size="small" type="primary" shape="circle"
                    icon={<TableOutlined />} onClick={() => inspectFeature && inspectFeature(feature)}
                    className={"feature-button-table"}
                />

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

const paintContributions = (params: {
    feature: Feature,
    x: d3.ScaleLinear<number, number>,
    className?: string,
    style?: React.CSSProperties
}) => {
    const { feature, x, className, style } = params;
    const cont = feature.contribution;
    const whatifcont = feature.contributionIfNormal;
    const posSegValue = _.range(0, 3).fill(0);
    const negSegValue = _.range(0, 3).fill(0);
    if (cont > 0) posSegValue[0] = cont;
    else negSegValue[0] = -cont;
    if (whatifcont !== undefined) {
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
    return <div className={className} style={style}>
        <svg className={"contribution-svg"}>
            {negSegValue[0] > 0 && <rect className="neg-feature a-and-b"
                width={x(negSegValue[0]) - x(0)} height={16} transform={`translate(${x(-negSegValue[0])}, 0)`} />}
            {negSegValue[1] > 0 && <rect className="neg-feature a-sub-b"
                width={x(negSegValue[1]) - x(0)} height={16} transform={`translate(${x(-negSegValue[1] - negSegValue[0])}, 0)`} />}
            {negSegValue[2] > 0 && <rect className="neg-feature b-sub-a"
                width={x(negSegValue[2]) - x(0)} height={16} transform={`translate(${x(-negSegValue[2] - negSegValue[0])}, 0)`} />}

            {posSegValue[0] > 0 && <rect className="pos-feature a-and-b"
                width={x(posSegValue[0]) - x(0)} height={16} transform={`translate(${x(0)}, 0)`} />}
            {posSegValue[1] > 0 && <rect className="pos-feature a-sub-b"
                width={x(posSegValue[1]) - x(0)} height={16} transform={`translate(${x(posSegValue[0])}, 0)`} />}
            {posSegValue[2] > 0 && <rect className="pos-feature b-sub-a"
                width={x(posSegValue[2]) - x(0)} height={16} transform={`translate(${x(posSegValue[0])}, 0)`} />}
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
    </div>
}
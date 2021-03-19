import { Feature, FeatureMeta } from "data/feature";
import { PatientMeta } from "data/patient";
import * as React from "react";
import * as d3 from "d3";
import { Badge, Button, Divider, Tooltip, Input } from "antd"
import { getFeatureMatrix, getFeatureValues, getPrediction, getSHAPValues } from "router/api";
import { DataFrame, IDataFrame } from "data-forge";
import * as _ from "lodash"
import { getScaleLinear, beautifulPrinter, defaultCategoricalColor } from "visualization/common";
import { ArrowDownOutlined, ArrowUpOutlined, CaretRightOutlined, LineChartOutlined, SortAscendingOutlined, TableOutlined } from "@ant-design/icons"
import { ItemDict } from "data/table";
import Histogram from "visualization/Histogram";
import { arrayShallowCompare, confidenceThresholds, getReferenceValue, ReferenceValue } from "data/common";

import "./index.scss"

export interface FeatureViewProps {
    patientMeta?: PatientMeta,
    tableNames?: string[],
    featureMeta: IDataFrame<number, FeatureMeta>,
    predictionTargets: string[],
    subjectIdG: number[],
    itemDicts?: ItemDict,
    entityCategoricalColor?: (entityName: string | undefined) => string,
    abnormalityColor?: (abnoramlity: number) => string,
    focusedFeatures: string[],
    inspectFeature?: (feature: Feature) => void,
    target: string,
}

export interface FeatureViewStates {
    // target: string,
    predictions?: (target: string) => number,
    featureDisplayValues?: DataFrame,
    features?: IDataFrame<number, Feature>,
    featureMatrix?: IDataFrame<number, any>,
    referenceValues?: IDataFrame<string, ReferenceValue>,
}

export default class FeatureView extends React.Component<FeatureViewProps, FeatureViewStates> {

    constructor(props: FeatureViewProps) {
        super(props);

        this.state = {
            // target: this.props.predictionTargets[1]
        };
        this.defaultCellWidth = this.defaultCellWidth.bind(this);
        // this.onSelectTarget = this.onSelectTarget.bind(this);
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

    private async updatePrediction() {
        const subject_id = this.props.patientMeta?.subjectId;
        if (subject_id !== undefined) {
            const predictions = await getPrediction({ subject_id });
            this.setState({ predictions })
        }
    }

    private defaultCellWidth(id: number) {
        const width = [150, 100, 150];
        return width[id];
    }

    // private onSelectTarget(target: string) {
    //     this.setState({ target });
    // }

    private async updateFeatures() {
        let { patientMeta, featureMeta, itemDicts,target } = this.props
        // const { target } = this.state;
        console.log('updateFeatures', target)
        const subject_id = patientMeta?.subjectId;
        if (subject_id !== undefined) {
            const featureValues = await getFeatureValues({ subject_id });
            const shapValues = await getSHAPValues({ subject_id, target });
            // level-1: individual features
            const L1Features: IDataFrame<number, Feature> = featureMeta.select(row => {
                return {
                    ...row,
                    value: featureValues(row['name']),
                    contribution: shapValues(row['name']),
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
                    alias: itemLabel || itemName,
                    value: undefined,
                    primitive: undefined,
                    contribution: _.sum(group.getSeries('contribution').toArray()),
                    children: group
                };
            }));
            // level-3: group-by period
            const L2Features = individualFeatures.concat(groupedFeature);
            const features = new DataFrame(L2Features.groupBy(row => row.type).toArray().map(group => {
                const sample = group.first();
                return {
                    ...sample,
                    alias: sample.type,
                    value: undefined,
                    primitive: undefined,
                    contribution: _.sum(group.getSeries('contribution').toArray()),
                    children: group
                }
            }))
            this.setState({ features })
        }
        console.log("Calculate features.")
    }

    componentDidUpdate(prevProps: FeatureViewProps, prevState: FeatureViewStates) {
        if (prevProps.patientMeta?.subjectId !== this.props.patientMeta?.subjectId
            || prevProps.target !== this.props.target) {
            this.updatePrediction();
            this.updateFeatures();
        }
    }

    public render() {
        const { predictionTargets,target, ...rest} = this.props;
        const { predictions, features, featureMatrix } = this.state;
        console.log('FeatureView', features)

        return (
            <div className="feature-view">
                {/*{predictionTargets && ProbaList({
                    predictionTargets, predictions,
                    selected: target,
                })}
                <Divider />*/}
                {features && <FeatureList
                    {...rest}
                    features={features}
                    cellWidth={this.defaultCellWidth}
                    featureMatrix={featureMatrix}
                    getReferenceValue={this.getReferenceValues}
                />}
            </div>
        )
    }
}

function ProbaList(params: {
    predictionTargets: string[],
    predictions?: (target: string) => number,
    selected?: string,
    onClick?: (value: string) => void,
}) {
    const { predictions, selected, onClick } = params;
    const predictionTargets = params.predictionTargets.filter(t => t !== 'complication');
    return <div className="proba-list">
        {predictionTargets.map(target =>
            <Button block key={target} className={"proba-item" + (selected && target === selected ? " proba-selected" : "")}
                onClick={() => onClick && onClick(target)}>
                <div className="proba-target-name">{target}</div>
                <div className="proba-value">{predictions ? predictions(target).toFixed(2) : '-'}</div>
                <div className="proba-bar" style={{ height: "100%", width: `${predictions ? predictions(target) * 100 : 1}%` }}></div>
            </Button>
        )}
    </div>
}

export interface FeatureListProps {
    features: IDataFrame<number, Feature>,
    cellWidth: (id: number) => number,
    entityCategoricalColor?: (entityName: string | undefined) => string,
    abnormalityColor?: (abnoramlity: number) => string,
    featureMatrix?: IDataFrame<number, any>,
    getReferenceValue: (name: string) => (ReferenceValue | undefined),
    focusedFeatures: string[],

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
    }

    private onClick(newOrder?: 'ascending' | 'dscending') {
        this.setState({ order: newOrder })
    }

    private getContributions(features: IDataFrame<number, Feature>): number[] {
        let contributions = features.getSeries('contribution').toArray();
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

    public render() {
        const { features, cellWidth, ...rest } = this.props;
        const { order } = this.state;
        const sortedFeatures = this.sortFeatures(features);
        const maxAbsCont = _.max(this.getContributions(sortedFeatures).map(v => Math.abs(v))) as number;
        const x = getScaleLinear(0, cellWidth(2), undefined, [-maxAbsCont, maxAbsCont]);

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
                            x={x!}
                            cellWidth={cellWidth}
                            key={row.name}
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

    inspectFeature?: (feature: Feature) => void,
}
export interface FeatureBlockStates {
    collapsed: boolean,
    expanded: boolean
}

export class FeatureBlock extends React.PureComponent<FeatureBlockProps, FeatureBlockStates> {
    constructor(props: FeatureBlockProps) {
        super(props);
        this.state = {
            collapsed: true,
            expanded: false
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
        if (featureNames.includes(feature.name))
            return true;
        if (feature.children?.where(row => this.hasFeature(row, featureNames)).count())
            return true;
        else
            return false
    }

    protected onClickButton() {
        const { inspectFeature, feature } = this.props;
        this.setState({ collapsed: !this.state.collapsed });
        // inspectFeature && inspectFeature(feature);
    }

    protected onClickDiv() {
        const { inspectFeature, feature } = this.props;
        this.setState({ expanded: !this.state.expanded });
        // inspectFeature && inspectFeature(feature);
    }

    render() {
        const { feature, x, cellWidth, entityCategoricalColor, abnormalityColor, inspectFeature,
            className, depth, featureMatrix, focusedFeatures, getReferenceValue } = this.props;
        const { collapsed, expanded } = this.state
        const { name, alias, value, contribution, children, entityId } = feature;
        const referenceValue = getReferenceValue(feature.name);

        // const series = featureMatrix?.getSeries(name).parseFloats().toArray();
        let valueColor = '#fff';
        let outofRange = undefined;
        if (referenceValue && typeof (value) === typeof (0.0) && abnormalityColor) {
            const { mean, std, ci95 } = referenceValue;
            const rate = Math.abs((value as number - mean) / std);
            valueColor = abnormalityColor(rate);
            if(value as number > ci95[1])
            	outofRange = 1
            else if(value as number < ci95[0])
            	outofRange = 0
        }
        let showState: 'normal' | 'focused' | 'unfocused' = 'normal';
        if (focusedFeatures.length > 0) {
            if (this.hasFeature(feature, focusedFeatures)) showState = 'focused';
            else showState = 'unfocused';
        }

        return <div className={className}>
            <div className="feature-row" style={{
                display: "flex", justifyContent: "flex-end", position: "relative",
                width: `calc(100% - ${depth * 10}px)`, left: `${depth * 10}px`
            }}>
                <div style={{ width: 20 }}>
                    {children && <CaretRightOutlined className="right-button"
                        onClick={this.onClickButton} rotate={collapsed ? 0 : 90} />}
                </div>
                <div className={`feature-block ${showState}` + ((depth === 0) ? " feature-top-block" : "")}
                    style={{
                        height: expanded ? 100 : 30,
                        borderRightColor: (entityCategoricalColor && entityCategoricalColor(entityId)) || '#aaa', borderRightWidth: 4
                    }}
                    onClick={children ? this.onClickButton : this.onClickDiv}>
                    <div className="feature-block-inner">
                        <Tooltip title={alias}>
                            <div className="feature-block-cell feature-name" style={{ width: cellWidth(0) - 10 * depth }}>
                                <span className={"feature-block-cell-text"}>{beautifulPrinter(alias, 25)}</span>
                            </div>
                        </Tooltip>
                        <Tooltip title={typeof (value) == typeof (0.0) ? beautifulPrinter(value) : value}>
                            <div className={"feature-block-cell feature-value"}
                                style={{ width: cellWidth(1), backgroundColor: valueColor }}>
                                <span className={"feature-block-cell-text"}>{beautifulPrinter(value)}
                                {outofRange && outofRange==0? <ArrowDownOutlined/> :''}
                                {outofRange && outofRange==1? <ArrowUpOutlined/> :''}

                                </span>
                            </div>
                        </Tooltip>
                        <div className={"feature-block-cell feature-contribution"}
                            style={{ width: cellWidth(2), opacity: Math.max(1 - 0.3 * depth, 0.5) }}>
                            {contribution > 0 ?
                                <div className="pos-feature"
                                    style={{
                                        width: x(contribution) - x(0),
                                        marginLeft: x(0)
                                    }} /> :
                                <div className="neg-feature"
                                    style={{
                                        width: x(0) - x(contribution),
                                        marginLeft: x(contribution)
                                    }} />
                            }
                        </div>
                    </div>
                    {(typeof (value) === typeof (0.0)) && expanded &&
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
                <Button size="small" type="primary" shape="circle"
                    icon={<LineChartOutlined />} onClick={() => inspectFeature && inspectFeature(feature)}
                    className={"feature-button-linechart"}
                />
                <Button size="small" type="primary" shape="circle"
                    icon={<TableOutlined />} onClick={() => inspectFeature && inspectFeature(feature)}
                    className={"feature-button-table"}
                />
                {/* <span className={"feature-block-dot"} style={{ backgroundColor: color || '#aaa' }} /> */}

            </div>

            {(!collapsed) && children?.toArray().map(feature =>
                <FeatureBlock
                    {...this.props}
                    depth={depth + 1}
                    feature={feature}
                />)}
        </div>
    }
}
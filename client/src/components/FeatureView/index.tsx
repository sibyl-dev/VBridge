import { Feature, FeatureMeta } from "data/feature";
import { PatientMeta } from "data/patient";
import * as React from "react";
import * as d3 from "d3";
import { Badge, Button, Divider, Tooltip, Input } from "antd"
import { getFeatureMatrix, getFeatureValues, getPrediction, getSHAPValues } from "router/api";
import { DataFrame, IDataFrame } from "data-forge";
import * as _ from "lodash"
import { getScaleLinear, beautifulPrinter, defaultCategoricalColor } from "visualization/common";
import { ArrowDownOutlined, ArrowUpOutlined, CaretRightOutlined, SortAscendingOutlined } from "@ant-design/icons"
import { ItemDict } from "data/table";
import Histogram from "visualization/Histogram";
import { confidenceThresholds } from "data/common";

import "./index.scss"

export interface FeatureViewProps {
    patientMeta?: PatientMeta,
    tableNames?: string[],
    featureMeta: IDataFrame<number, FeatureMeta>,
    predictionTargets: string[],
    subjectIdG: number[],
    itemDicts?: ItemDict,
    color?: (entityName: string) => string,
}

export interface FeatureViewStates {
    target: string,
    predictions?: (target: string) => number,
    featureDisplayValues?: DataFrame,
    features?: IDataFrame<number, Feature>,
    featureMatrix?: IDataFrame<number, any>
}

export default class FeatureView extends React.Component<FeatureViewProps, FeatureViewStates> {

    constructor(props: FeatureViewProps) {
        super(props);

        this.state = {
            target: this.props.predictionTargets[1]
        };
        this.defaultCellWidth = this.defaultCellWidth.bind(this);
        this.onSelectTarget = this.onSelectTarget.bind(this);
    }

    componentDidMount() {
        this.loadFeatureMatrix();
    }

    private async loadFeatureMatrix() {
        const featureMatrix = await getFeatureMatrix();
        this.setState({ featureMatrix });
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

    private onSelectTarget(target: string) {
        this.setState({ target });
    }

    private async updateFeatures() {
        const { patientMeta, featureMeta, itemDicts } = this.props
        const { target } = this.state;
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
                const itemLabel = itemDicts && itemDicts(sample.entityId, itemName)?.LABEL;
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
    }

    componentDidUpdate(prevProps: FeatureViewProps, prevState: FeatureViewStates) {
        if (prevProps.patientMeta?.subjectId !== this.props.patientMeta?.subjectId
            || prevState.target !== this.state.target) {
            this.updatePrediction();
            this.updateFeatures();
        }
        if (prevProps.subjectIdG?.sort().toString() !== this.props.subjectIdG.sort().toString()) {
            this.loadFeatureMatrix()
        }
    }

    public render() {
        const { predictionTargets, color } = this.props;
        const { predictions, features, target, featureMatrix } = this.state;

        return (
            <div className="feature-view">
                {predictionTargets && ProbaList({
                    predictionTargets, predictions,
                    selected: target, onClick: this.onSelectTarget
                })}
                <Divider />
                {features && <FeatureList
                    features={features}
                    cellWidth={this.defaultCellWidth}
                    color={color}
                    featureMatrix={featureMatrix}
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
    color?: (entityName: string) => string,
    featureMatrix?: IDataFrame<number, any>
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
        const { features, cellWidth, color, featureMatrix } = this.props;
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
                            feature={row}
                            depth={0}
                            x={x!}
                            cellWidth={cellWidth}
                            key={row.name}
                            color={color}
                            featureMatrix={featureMatrix}
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
    x: d3.ScaleLinear<number, number>,
    cellWidth: (id: number) => number,
    color?: (entityName: string) => string,
}
export interface FeatureBlockStates {
    collapsed: boolean,
    expanded: boolean
}

export class FeatureBlock extends React.Component<FeatureBlockProps, FeatureBlockStates> {
    constructor(props: FeatureBlockProps) {
        super(props);
        this.state = {
            collapsed: true,
            expanded: false
        }

        this.onClickButton = this.onClickButton.bind(this);
        this.onClickDiv = this.onClickDiv.bind(this)
    }

    componentDidUpdate(prevProps: FeatureBlockProps) {
        if (prevProps.feature.name !== this.props.feature.name) {
            this.setState({ collapsed: true });
        }
    }

    protected onClickButton() {
        this.setState({ collapsed: !this.state.collapsed });
    }

    protected onClickDiv() {
        this.setState({ expanded: !this.state.expanded });
    }

    render() {
        const { feature, x, cellWidth, color, className, depth, featureMatrix } = this.props;
        const { collapsed, expanded } = this.state
        const { name, alias, value, contribution, children, entityId } = feature;
        let series = undefined;
        let thresholds = [];
        let colorIndex = 3;
        // const barColor = d3.scaleSequential(d3.interpolateRdYlGn).domain([0, 6]);
        const barColor = (id: number) => {
            if (id > 3)
                return d3.interpolateReds((id / 3 - 1) * 0.3);
            else if (id < 3)
                return d3.interpolateBlues((1 - id / 3) * 0.3);
        }

        if (typeof (value) === typeof (0.0)) {
            series = featureMatrix?.getSeries(name).parseFloats().toArray();
            if (series) {
                // console.log(series.where(row => row > (value as number)).count() / series.count());
                thresholds = confidenceThresholds(series);
                colorIndex = _.sum(thresholds.map(t => t < value!));
            }
        }

        return <div className={className}>
            <div style={{
                display: "flex", justifyContent: "flex-end", position: "relative",
                width: `calc(100% - ${depth * 10}px)`, left: `${depth * 10}px`
            }}>
                <div style={{ width: 20 }}>
                    {children && <CaretRightOutlined className="right-button"
                        onClick={this.onClickButton} rotate={collapsed ? 0 : 90} />}
                </div>
                <div className={(children ? "feature-group-block" : "feature-block") +
                    ((depth === 0) ? " feature-top-block" : "")} key={name}
                    style={{
                        height: expanded ? 100 : 30,
                        borderRightColor: (color && color(entityId)) || '#aaa', borderRightWidth: 4
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
                                style={{ width: cellWidth(1), backgroundColor: barColor(colorIndex) }}>
                                <span className={"feature-block-cell-text"}>{beautifulPrinter(value)}</span>
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
                    {series && series.length && expanded ?
                        <div className="feature-block-hist">
                            <Histogram
                                data={series}
                                height={60}
                                width={cellWidth(1) + 20}
                                drawAxis={false}
                                margin={{ left: 10, bottom: 15 }}
                                referenceValue={value as number}
                            />
                        </div> : ''}
                </div>
                {/* <span className={"feature-block-dot"} style={{ backgroundColor: color || '#aaa' }} /> */}

            </div>
            {!collapsed && children?.toArray().map(feature =>
                <FeatureBlock
                    className={className}
                    depth={depth + 1}
                    feature={feature}
                    x={x!}
                    cellWidth={cellWidth}
                    color={color}
                    key={feature.name}
                    featureMatrix={featureMatrix}
                />)}
        </div>
    }
}
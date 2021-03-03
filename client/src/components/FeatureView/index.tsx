import { Feature, FeatureMeta } from "data/feature";
import { PatientMeta } from "data/patient";
import * as React from "react";
import { Button, Divider, Tooltip, Input } from "antd"
import "./index.css"
import { getFeatureValues, getPrediction, getSHAPValues } from "router/api";
import { DataFrame, IDataFrame } from "data-forge";
import * as _ from "lodash"
import { getScaleLinear, beautifulPrinter } from "visualization/common";
import { ArrowDownOutlined, ArrowUpOutlined, CaretRightOutlined, SortAscendingOutlined } from "@ant-design/icons"
import { ScaleLinear } from "d3";

const { Search } = Input;

export interface FeatureViewProps {
    patientMeta?: PatientMeta,
    featureMeta: IDataFrame<number, FeatureMeta>,
    predictionTargets: string[]
}

export interface FeatureViewStates {
    target: string,
    predictions?: (target: string) => number,
    featureDisplayValues?: DataFrame,
    features?: IDataFrame<number, Feature>,
}

export default class FeatureView extends React.Component<FeatureViewProps, FeatureViewStates> {

    constructor(props: FeatureViewProps) {
        super(props);

        this.state = {
            target: this.props.predictionTargets[0]
        };
        this.defaultCellWidth = this.defaultCellWidth.bind(this);
        this.onSelectTarget = this.onSelectTarget.bind(this);
    }

    private async updatePrediction() {
        const subject_id = this.props.patientMeta?.subjectId;
        if (subject_id !== undefined) {
            const predictions = await getPrediction({ subject_id });
            this.setState({ predictions })
        }
    }

    private defaultCellWidth(id: number) {
        const width = [120, 100, 120];
        return width[id];
    }

    private onSelectTarget(target: string) {
        this.setState({ target });
    }

    private async updateFeatures() {
        const { patientMeta, featureMeta, predictionTargets } = this.props
        const { target } = this.state;
        const subject_id = patientMeta?.subjectId;
        if (subject_id !== undefined) {
            const featureValues = await getFeatureValues({ subject_id });
            const shapValues = await getSHAPValues({ subject_id, target });
            const rawFeatures: IDataFrame<number, Feature> = featureMeta.select(row => {
                return {
                    ...row,
                    value: featureValues(row['name']),
                    contribution: shapValues(row['name']),
                };
            });
            const individualFeatures = rawFeatures.where(row => row.where_item.length == 0);
            const whereFeatures = rawFeatures.where(row => row.where_item.length > 0);
            const groups = whereFeatures.groupBy(row => row.where_item[1]).toArray();
            const groupedFeature: IDataFrame<number, Feature> = new DataFrame(groups.map(group => {
                const sample = group.first();
                return {
                    ...sample,
                    alias: sample.where_item![1] as string,
                    value: undefined,
                    primitive: undefined,
                    contribution: _.sum(group.getSeries('contribution').toArray()),
                    children: group
                };
            }));
            const features = individualFeatures.concat(groupedFeature);
            this.setState({ features })
        }
    }

    componentDidUpdate(prevProps: FeatureViewProps, prevState: FeatureViewStates) {
        if (prevProps.patientMeta?.subjectId !== this.props.patientMeta?.subjectId
            || prevState.target !== this.state.target) {
            this.updatePrediction();
            this.updateFeatures();
        }
    }

    public render() {
        const { predictionTargets } = this.props;
        const { predictions, features, target } = this.state;

        return (
            <div style={{ height: "100%", width: "100%" }}>
                {predictionTargets && ProbaList({
                    predictionTargets, predictions,
                    selected: target, onClick: this.onSelectTarget
                })}
                <Divider />
                {features && <FeatureList
                    features={features}
                    cellWidth={this.defaultCellWidth}
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
    const { predictionTargets, predictions, selected, onClick } = params
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
}

export interface FeatureListStates {
    // Contribution sorting order
    order?: 'ascending' | 'dscending',
}

export class FeatureList extends React.Component<FeatureListProps, FeatureListStates> {
    constructor(props: FeatureListProps) {
        super(props);

        this.state = {};

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
        const { features, cellWidth } = this.props;
        const { order } = this.state;
        const sortedFeatures = this.sortFeatures(features);
        const x = getScaleLinear(0, cellWidth(2), this.getContributions(sortedFeatures));

        return <div style={{ width: "100%" }}>
            <Search placeholder="input search text" style={{ marginLeft: 10, marginRight: 10, width: "90%" }} enterButton />
            <div style={{ width: "100%" }}>
                <div className="feature-header">
                    <div style={{ width: 20 }} />
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
    feature: Feature,
    x: ScaleLinear<number, number>,
    cellWidth: (id: number) => number,
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
        const { feature, x, cellWidth } = this.props;
        const { collapsed, expanded } = this.state
        const { name, alias, value, contribution, children } = feature;
        return <div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{ width: 20 }}>
                    {children && <CaretRightOutlined className="right-button"
                        onClick={this.onClickButton} rotate={collapsed ? 0 : 90} />}
                </div>
                <div className="feature-block" key={name} style={{ height: expanded ? 100 : 30 }}
                    onClick={children ? this.onClickButton : this.onClickDiv}>
                    <Tooltip title={alias}>
                        <div className="feature-block-cell feature-name" style={{ width: cellWidth(0) }}>
                            {beautifulPrinter(alias)}
                        </div>
                    </Tooltip>
                    <Tooltip title={value}>
                        <div className={"feature-block-cell" + (children ? " feature-group-value" : " feature-value")}
                            style={{ width: cellWidth(1) }}>
                            {beautifulPrinter(value)}
                        </div>
                    </Tooltip>
                    <div className={"feature-block-cell feature-contribution"} style={{ width: cellWidth(2) }}>
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
            </div>
            {!collapsed && children?.toArray().map(feature =>
                <FeatureBlock
                    feature={feature}
                    x={x!}
                    cellWidth={id => id === 0 ? cellWidth(id) - 10 : cellWidth(id)}
                    key={feature.name}
                />)}
        </div>
    }
}
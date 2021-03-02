import { Feature, FeatureMeta } from "data/feature";
import { PatientMeta } from "data/patient";
import * as React from "react";
import { Button, Divider, Tooltip, Input } from "antd"
import "./index.css"
import { getFeatureValues, getPrediction, getSHAPValues } from "router/api";
import { DataFrame, IDataFrame } from "data-forge";
import * as _ from "lodash"
import { getScaleLinear } from "visualization/common";
import { ArrowDownOutlined, ArrowUpOutlined, SortAscendingOutlined } from "@ant-design/icons"

const { Search } = Input;

export interface FeatureViewProps {
    patientMeta?: PatientMeta,
    featureMeta: DataFrame<number, FeatureMeta>,
    predictionTargets: string[]
}

export interface FeatureViewStates {
    predictions?: (target: string) => number
    featureDisplayValues?: DataFrame
    features?: DataFrame<number, any> |
    IDataFrame<number, any>,
}

export default class FeatureView extends React.Component<FeatureViewProps, FeatureViewStates> {

    constructor(props: FeatureViewProps) {
        super(props);

        this.state = {};
    }

    private async updatePrediction() {
        const subject_id = this.props.patientMeta?.subjectId;
        if (subject_id !== undefined) {
            const predictions = await getPrediction({ subject_id });
            this.setState({ predictions })
        }
    }

    private async updateFeatures() {
        const { patientMeta, featureMeta, predictionTargets } = this.props
        const subject_id = patientMeta?.subjectId;
        if (subject_id !== undefined) {
            const featureValues = await getFeatureValues({ subject_id });
            const shapValues = await getSHAPValues({ subject_id, target: 'complication' });
            const features = featureMeta.select(row => {
                const name = row['name'];
                const value = featureValues(name);
                return {
                    Name: row['alias'],
                    Value: (typeof (value) === typeof (0.0)) ? _.round(value, 3) : value,
                    Contribution: _.round(shapValues(row['name']), 3)
                }
            })
            this.setState({ features })
        }
    }

    componentDidUpdate(prevProps: FeatureViewProps) {
        if (prevProps.patientMeta?.subjectId !== this.props.patientMeta?.subjectId) {
            this.updatePrediction();
            this.updateFeatures();
        }
    }

    public render() {
        const { predictionTargets } = this.props;
        const { predictions, features } = this.state;

        return (
            <div style={{ height: "100%", width: "100%" }}>
                {predictionTargets && ProbaList({ predictionTargets, predictions })}
                <Divider />
                {features && <FeatureList
                    features={features}
                />}
            </div>
        )
    }
}

function ProbaList(params: {
    predictionTargets: string[],
    predictions?: (target: string) => number
}) {
    const { predictionTargets, predictions } = params
    return <div className="proba-list">
        {predictionTargets.map(target =>
            <Button block key={target} className="proba-item">
                <div className="proba-target-name">{target}</div>
                <div className="proba-value">{predictions ? predictions(target).toFixed(2) : '-'}</div>
                <div className="proba-bar" style={{ height: "100%", width: `${predictions ? predictions(target) * 80 : 1}%` }}></div>
            </Button>
        )}
    </div>
}

export interface FeatureListProps {
    features: DataFrame<number, any> | IDataFrame<number, any>
}

export interface FeatureListStates {
    // Contribution sorting order
    order?: 'ascending' | 'dscending'
}

export class FeatureList extends React.Component<FeatureListProps, FeatureListStates> {
    constructor(props: FeatureListProps) {
        super(props);

        this.state = {};

        this.onClick = this.onClick.bind(this);
    }

    private onClick(newOrder?: 'ascending' | 'dscending') {

        this.setState({ order: newOrder })
    }

    protected featureBlock() {

    }

    public render() {
        const { order } = this.state;
        let features = this.props.features;
        if (order === 'ascending')
            features = features.orderBy(row => row.Contribution);
        else if (order == 'dscending')
            features = features.orderBy(row => -row.Contribution);
        const width = 120;
        const contributions = features?.getSeries('Contribution');
        const x = contributions && getScaleLinear(0, width, contributions);


        return <div style={{ width: "100%" }}>
            <Search placeholder="input search text" style={{ marginLeft: 10, marginRight: 10, width: "90%" }} enterButton />
            <div style={{ width: "100%" }}>
                <div className="feature-header">
                    <div className="feature-header-text">
                        <span>Name</span>
                        <SortAscendingOutlined />
                    </div>
                    <div className="feature-header-text">Value</div>
                    <div className="feature-header-text">
                        <span>Contribution</span>
                        {order === 'dscending' ? <ArrowDownOutlined onClick={this.onClick.bind(this, 'ascending')} />
                            : <ArrowUpOutlined onClick={this.onClick.bind(this, 'dscending')} />}
                    </div>
                </div>
                {features?.toArray().map(row =>
                    <div className="feature-block" key={row.Name}>
                        <Tooltip title={row.Name}>
                            <div className="feature-block-text feature-name">
                                {row.Name.length > 12 ? row.Name.substring(0, 12) + "..." : row.Name}
                            </div>
                        </Tooltip>
                        <Tooltip title={row.Value}>
                            <div className="feature-block-text feature-value">
                                {typeof (row.Value) === typeof ("") && row.Value.length > 12 ? row.Value.substring(0, 12) + "..." : row.Value}
                            </div>
                        </Tooltip>
                        <div className={"feature-block-text feature-contribution"}>
                            {row.Contribution > 0 ?
                                <div className="pos-feature"
                                    style={{
                                        width: x!(row.Contribution) - x!(0),
                                        marginLeft: x!(0)
                                    }} /> :
                                <div className="neg-feature"
                                    style={{
                                        width: x!(0) - x!(row.Contribution),
                                        marginLeft: x!(row.Contribution)
                                    }} />
                            }
                        </div>
                    </div>
                )}
            </div>
        </div>
    }
}
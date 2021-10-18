import * as React from "react";
import * as _ from "lodash"
import { DataFrame, IDataFrame } from "data-forge";
import { Feature } from "type";
import { getReferenceValue } from "utils/common";
import { Label, StatValues } from "type/resource";
import { ColorManager } from "visualization/color";
import { FeatureList } from "./FeatureList";

import "./index.scss"

export interface FeatureViewProps {
    className?: string,
    features: IDataFrame<number, Feature>,

    prediction?: number,
    target?: string,

    featureMat?: IDataFrame<number, any>,
    predictions?: number[],
    label?: Label,

    display?: 'normal' | 'dense',
    focusedFeatures: string[],
    colorManager?: ColorManager

    inspectFeatureInSignal?: (feature: Feature) => void,
    inspectFeatureInTable?: (feature: Feature) => void,
}

export interface FeatureViewStates {
    desiredFM?: IDataFrame<number, any>,
    undesiredFM?: IDataFrame<number, any>,
    referenceValues?: IDataFrame<string, StatValues>,
}

export default class FeatureView extends React.Component<FeatureViewProps, FeatureViewStates> {

    constructor(props: FeatureViewProps) {
        super(props);

        this.state = {};
        this.updateReferenceValues = this.updateReferenceValues.bind(this);
    }

    componentDidMount() {
        this.updateReferenceValues();
    }

    // run when the group ids updates
    private updateReferenceValues() {
        const { featureMat } = this.props;
        if (featureMat) {
            const desiredFM = featureMat.where(row => row['complication'] === 0);
            const undesiredFM = featureMat.where(row => row['complication'] !== 0);
            if (desiredFM.count() == 0) alert("No patient in the selection.");
            else {
                const featureIds = featureMat.getColumnNames();
                const referenceValues = new DataFrame({
                    index: featureIds,
                    values: featureIds.map(name =>
                        getReferenceValue(desiredFM.getSeries(name).toArray())
                    )
                })
                this.setState({ desiredFM: desiredFM, undesiredFM: undesiredFM, referenceValues });
            }
        }
    }

    componentDidUpdate(prevProps: FeatureViewProps) {
        const { features, featureMat } = this.props;
        if (prevProps.featureMat != featureMat || prevProps.features != features) {
            this.updateReferenceValues();
        }
    }

    public render() {
        const { features, ...rest } = this.props;
        const { desiredFM, undesiredFM, referenceValues } = this.state;
        const contextFeatureValues = [];
        if (desiredFM) contextFeatureValues.push(desiredFM);
        if (undesiredFM) contextFeatureValues.push(undesiredFM);

        return (
            <div className="feature-view">
                <FeatureList
                    {...rest}
                    features={features}
                    referenceMat={contextFeatureValues}
                    referenceValues={referenceValues}
                />
            </div>
        )
    }
}

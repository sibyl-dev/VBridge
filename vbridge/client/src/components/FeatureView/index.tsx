import * as React from "react";
import * as _ from "lodash"
import { DataFrame, IDataFrame, Series } from "data-forge";
import { Feature } from "type";
import { getReferenceValue, isDefined } from "utils/common";
import { Label, PredictionResponse, StatValues } from "type/resource";
import { ColorManager } from "visualization/color";
import { FeatureList } from "./FeatureList";

import "./index.scss"

export interface FeatureViewProps {
    className?: string,
    features: IDataFrame<number, Feature>,

    prediction?: number,
    target?: string,

    featureMat?: IDataFrame<number, any>,
    predictions?: PredictionResponse,
    label?: Label,

    display?: 'normal' | 'dense',
    focusedFeatures: string[],
    colorManager?: ColorManager

    inspectFeatureInSignal?: (feature: Feature) => void,
    inspectFeatureInTable?: (feature: Feature) => void,
}

export interface FeatureViewStates {
    referenceMat?: Record<string, any[][]>,
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
        const { featureMat, predictions, target } = this.props;
        if (featureMat && predictions && target) {
            const predArray = predictions[target];
            const featureMatWithPred = featureMat.ensureSeries(target, new Series(predArray));
            const desiredFM = featureMatWithPred.where(row => row[target] <= 0.5);
            const undesiredFM = featureMatWithPred.where(row => row[target] > 0.5);
            if (desiredFM.count() == 0) alert("No patient in the selection.");
            else {
                const featureIds = featureMat.getColumnNames();
                const referenceMat: Record<string, any[][]> = {};
                featureIds.forEach(name => referenceMat[name] = [desiredFM, undesiredFM]
                    .map(fm => {
                        let series = fm.getSeries(name).where(d => isDefined(d) && d !== '');
                        if (series.where(d => isNaN(d)).count() == 0) series = series.parseFloats()
                        return series.toArray();
                    }));
                const referenceValues = new DataFrame({
                    index: featureIds,
                    values: featureIds.map(name =>
                        getReferenceValue(referenceMat[name][0]))
                })
                console.log(referenceMat, this.props.features);
                this.setState({ referenceValues, referenceMat });
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
        const { referenceMat, referenceValues } = this.state;

        return (
            <div className="feature-view">
                <FeatureList
                    {...rest}
                    features={features}
                    referenceMat={referenceMat}
                    referenceValues={referenceValues}
                />
            </div>
        )
    }
}

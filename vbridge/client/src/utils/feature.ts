import { IDataFrame } from "data-forge";
import { CfShapValues, Feature, FeatureSchema, FeatureValue, ShapValues } from "type";

export function buildFeatures(
    featureSchema: IDataFrame<number, FeatureSchema>,
    featureValues: FeatureValue,
    shapValues?: ShapValues,
    cfShapValues?: CfShapValues,
): IDataFrame<number, Feature> {
    return featureSchema.select(row => {
        const whatifResults = cfShapValues && cfShapValues[row['id']];
        return {
            ...row,
            value: featureValues[row['id']],
            contribution: shapValues ? shapValues[row['id']] : 0,
            contributionIfNormal: whatifResults && whatifResults.shap,
            predictionIfNormal: whatifResults && whatifResults.prediction,
        };
    });
}
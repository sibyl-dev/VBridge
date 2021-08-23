import { DataFrame, IDataFrame } from "data-forge";
import { FeatureSchema, FeatureSchemaResponse, FeatureValue, SHAP, WhatIfSHAP } from "./resource";

export interface Feature extends FeatureSchema {
    value?: number | string,
    shap: number,
    whatIfShap?: number,
    whatIfPred?: number,
    children?: IDataFrame<number, Feature>,
}

export interface VFeature extends Feature {
    show: boolean
}

export function buildFeatures(
    featureSchema: FeatureSchemaResponse,
    featureValues: FeatureValue,
    shap?: SHAP,
    whatIfShap?: WhatIfSHAP,
): IDataFrame<number, Feature> {
    const features: Feature[] = featureSchema.map(fs => {
        const featureId = fs.id;
        return {
            ...fs,
            value: featureValues[featureId],
            shap: (shap && shap[featureId]) || 0,
            whatIfShap: whatIfShap && whatIfShap[featureId]?.shap,
            whatIfPred: whatIfShap && whatIfShap[featureId]?.prediction,
        }
    });
    const topFeatures = features.filter(feat => feat.parentId === undefined);
    // TODO: sum the contribution
    return featureArray2DF(topFeatures, features);
}

function featureArray2DF(topFeats: Feature[], allFeats: Feature[]): IDataFrame<number, Feature> {
    const featuresWithChildren = topFeats.map(feat => {
        return {
            ...feat,
            children: feat.childrenIds && featureArray2DF(allFeats.filter((f, i) =>
                feat.childrenIds?.includes(i)), allFeats)
        }
    })
    return new DataFrame(featuresWithChildren)
}
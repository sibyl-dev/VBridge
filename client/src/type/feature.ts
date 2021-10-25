import _ from "lodash";
import { DataFrame, IDataFrame } from "data-forge";
import { FeatureSchema, FeatureSchemaResponse, FeatureValue, SHAP, WhatIfSHAP } from "./resource";

export interface BaseFeature extends FeatureSchema {
    shap: number,
    whatIfShap?: number,
    whatIfPred?: number,
}

export interface CategoricalFeature extends BaseFeature {
    value: string,
}

export interface NumericalFeature extends BaseFeature {
    value: number,
}

export interface GroupFeature extends BaseFeature {
    value: undefined,
    children: IDataFrame<number, Feature>,
}

export function isGroupFeature(feature: Feature): feature is GroupFeature {
    return feature.value === undefined;
}

export function isCategoricalFeature(feature: Feature): feature is CategoricalFeature {
    return (!isGroupFeature(feature) && typeof (feature.value) === 'string');
}

export function isNumericalFeature(feature: Feature): feature is NumericalFeature {
    return (!isGroupFeature(feature) && typeof (feature.value) === 'number');
}

export type Feature = CategoricalFeature | NumericalFeature | GroupFeature;

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
            shap: shap ? shap[featureId] : 0,
            whatIfShap: whatIfShap && whatIfShap[featureId]?.shap,
            whatIfPred: whatIfShap && whatIfShap[featureId]?.prediction,
        } as Feature
    });
    const topFeatures = features.filter(feat => feat.parentId === undefined);
    // TODO: sum the contribution
    return featureArray2DF(topFeatures, features);
}

function featureArray2DF(topFeats: Feature[], allFeats: Feature[]): IDataFrame<number, Feature> {
    const featuresWithChildren = topFeats.map(feat => {
        const children = feat.childrenIds && featureArray2DF(allFeats.filter((f, i) =>
            feat.childrenIds?.includes(i)), allFeats);
        return {
            ...feat,
            children: children,
            shap: children ? _.sum(children?.getSeries('shap').toArray()) : feat.shap
        } as Feature
    })
    return new DataFrame(featuresWithChildren)
}

export function getRelatedFeatures(params: {
    featureSchema: FeatureSchema[], entityId: string,
    columnId?: string, itemId?: string, startTime?: Date, endTime?: Date
}): string[] {
    const { featureSchema, entityId, columnId, itemId, startTime, endTime } = params;
    let candidates = featureSchema.filter(row => (!row.childrenIds || row.childrenIds.length === 0));
    candidates = candidates.filter(row => row.entityId === entityId);
    if (columnId) candidates = candidates.filter(row => row.columnId === columnId);
    if (itemId) candidates = candidates.filter(row => row.item?.itemId === itemId);

    // TODO: filter by time period.
    return candidates.map(f => f.id);
}

interface VCategoricalFeature extends CategoricalFeature {
    show: boolean,
    parent?: VGroupFeature,
}

interface VNumericalFeature extends NumericalFeature {
    show: boolean,
    parent?: VGroupFeature,
}

interface VGroupFeature extends GroupFeature {
    show: boolean,
    parent?: VGroupFeature,
    children: IDataFrame<number, VFeature>,
}

export type VFeature = VCategoricalFeature | VNumericalFeature | VGroupFeature;

function buildShowState(feature: Feature, parent?: VGroupFeature): VFeature {
    const featWithState = {
        ...feature,
        show: false,
        parent: parent
    };
    if (isGroupFeature(feature)) {
        return {...featWithState, 
            children: feature.children.select(f => buildShowState(f))} as VGroupFeature;
    }
    else {
        return featWithState as VFeature
    }
}

export function buildShowStateList(features: IDataFrame<number, Feature>):
    IDataFrame<number, VFeature> {
    let VFeatureTree = features.select(f => buildShowState(f));
    VFeatureTree = VFeatureTree.select(f => ({ ...f, show: true }));
    return VFeatureTree;
}

import _ from "lodash";
import { DataFrame, IDataFrame } from "data-forge";
import { FeatureSchema, FeatureSchemaResponse, FeatureValue, SHAP, WhatIfSHAP } from "./resource";

export interface Feature extends FeatureSchema {
    value?: number | string,
    shap: number,
    whatIfShap?: number,
    whatIfPred?: number,
    children?: IDataFrame<number, Feature>,
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
            shap: shap ? shap[featureId] : 0,
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
        const children = feat.childrenIds && featureArray2DF(allFeats.filter((f, i) =>
            feat.childrenIds?.includes(i)), allFeats);
        return {
            ...feat,
            children: children,
            shap: _.sum(children?.getSeries('shap').toArray()) || feat.shap
        }
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

export interface VFeature extends Feature {
    show: boolean,
    children?: IDataFrame<number, VFeature>,
    parent?: VFeature,
}

function buildShowState(feature: Feature, parent?: VFeature): VFeature {
    const nodeState: VFeature = {
        ...feature,
        show: false,
        parent: parent,
        children: feature.children?.select<VFeature>(f => buildShowState(f))
    };
    return nodeState;
}

function extractSelfAndChildren(showState: VFeature): VFeature[] {
    return [showState, ..._.flatten(showState.children?.select(f => extractSelfAndChildren(f)).toArray())];
}

export function buildShowStateList(features: IDataFrame<number, Feature>): IDataFrame<number, VFeature> {
    let VFeatureTree = features.select(f => buildShowState(f));
    VFeatureTree = VFeatureTree.select(f => ({...f, show: true}));
    // const VFeatureList: VFeature[] = _.flatten(VFeatureTree.map(s => extractSelfAndChildren(s)));
    // return VFeatureList;
    return VFeatureTree;
}

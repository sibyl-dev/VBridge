import { ISeries } from "data-forge";
import { Entity, Feature, getRelatedFeatures } from "type";
import { assert, isDefined } from "utils/common";
import { FeatureSchema, Patient, ReferenceValueResponse, StatValues } from "./resource";

export interface SignalMeta {
    entityId: string,
    columnId: string,
    itemId: string,
    itemAlias?: string,
    startTime?: Date,
    endTime?: Date,
    relatedFeatureNames: string[],
    statValues?: StatValues,
    featurePeriods?: (name: string) => [Date, Date]
}

export interface Signal extends SignalMeta {
    data?: { dates: ISeries<any, Date>, values: ISeries<any, number> }
}

export function buildSignalsByFeature(params: {
    feature: Feature,
    temporal: Entity<any, any>[],
    referenceValues?: ReferenceValueResponse,
}): SignalMeta[] {
    const { feature, temporal, referenceValues } = params;
    let signalMetaList: SignalMeta[] = [];
    if (feature.children && feature.children.count() > 0) {
        for (const child of feature.children) {
            signalMetaList = signalMetaList.concat(buildSignalsByFeature({ ...params, feature: child }))
        }
    }
    else {
        const { entityId, item, columnId: columnName, id: name } = feature;
        const entity = temporal.find(e => e.id === entityId);
        assert(isDefined(entity), "Entity not found.")
        const { item_index, time_index, item_dict } = entity.schema;
        if (item_index && time_index && entityId) {
            const itemId = item!.itemId;
            signalMetaList.push({
                entityId: entityId,
                columnId: columnName,
                itemId: itemId,
                itemAlias: item_dict && item_dict[itemId],
                relatedFeatureNames: name ? [name] : [],
                statValues: referenceValues && referenceValues[entityId][itemId][columnName],
            })
        }
    }
    return signalMetaList
}

export function buildRecordByPeriod(params: {
    featureSchema: FeatureSchema[], entity: Entity<any, any>, 
    startTime: Date, endTime: Date, referenceValues?: ReferenceValueResponse
}): SignalMeta[] {
    const { referenceValues, featureSchema, entity, startTime, endTime } = params;
    const { item_index, time_index, value_indexes, item_dict } = entity.schema!;
    let records: SignalMeta[] = []
    if (item_index && time_index && value_indexes && value_indexes.length > 0) {
        const selectedDf = entity.where(row => startTime < new Date(row[time_index]) && new Date(row[time_index]) < endTime)
            .groupBy(row => (row[item_index]));
        for (const itemDf of selectedDf) {
            const itemRecords: SignalMeta[] = value_indexes.map(columnId => {
                const itemId = itemDf.first()[item_index];
                return {
                    entityId: entity.id,
                    columnId: columnId,
                    itemId: itemId,
                    itemAlias: item_dict && item_dict[itemId],
                    startTime: startTime,
                    endTime: endTime,
                    statValues: referenceValues && referenceValues[entity.id][itemId][columnId],
                    // TODO: check this
                    relatedFeatureNames: getRelatedFeatures({ featureSchema, entityId: entity.id, itemId, startTime, endTime })
                }
            })
            records = [...records, ...itemRecords]
        }
    }
    return records;
}
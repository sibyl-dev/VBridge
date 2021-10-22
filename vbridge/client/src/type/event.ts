import _ from "lodash";
import { ISeries } from "data-forge";
import { Entity } from "type";
import { isDefined } from "utils/common";
import { getQuarter, QUATER_IN_MILI } from "visualization/common";
import { ReferenceValues } from "./resource";

export type MetaEvent = {
    name: string,
    timestamp: Date,
}

export type IEvent = {
    entityName: string,
    timestamp: Date,
    count: number,
    items: string[],
    abnormalItems: string[]
}

export interface IEventBin {
    entityName: string,
    binId: number,
    binStartTime: Date,
    binEndTime: Date,
    count: number,
    items: string[],
    abnormalItems: string[]
}

export function groupCoinEvents(entity: Entity<string, any>, referenceValues?: ReferenceValues) {
    const { time_index, entityId, value_indexes } = entity.schema;
    const valIndex = value_indexes && value_indexes[0];

    const eventSeries: ISeries<number, IEvent> = entity
        .groupBy(row => row[time_index!])
        .select(group => {
            const { item_index: itemIndex } = entity.schema;
            const items = _.uniq(group.getSeries(itemIndex!).toArray());
            const abnormalItems: string[] = [];
            if (referenceValues && valIndex && itemIndex) {
                group.forEach(row => {
                    const item = row[itemIndex];
                    const statValues = referenceValues[item][valIndex];
                    const outOfRange = (row[valIndex] > statValues.ci95[1]) ||
                        (row[valIndex] < statValues.ci95[0]);
                    if (outOfRange) {
                        abnormalItems.push(item);
                    }
                })
            }
            return {
                entityName: entityId,
                timestamp: new Date(group.first()[time_index!]),
                count: group.count(),
                items: items,
                abnormalItems: abnormalItems
            }
        });
    return eventSeries
}

export function binEvents(events: ISeries<number, IEvent>, interval: number, startTime: Date) {
    const eventBinSeries: ISeries<number, IEventBin> = events
        .groupBy(row => Math.floor(getQuarter(row.timestamp) / interval))
        .select(group => {
            const sample = group.first();
            const binId = Math.floor((getQuarter(sample.timestamp) - getQuarter(startTime)) / interval);
            const binStartTime = new Date(startTime.getTime() + binId * (QUATER_IN_MILI * interval));
            const binEndTime = new Date(startTime.getTime() + (binId + 1) * (QUATER_IN_MILI * interval));
            const items: string[] = _.uniq(_.flatten(group.select(d => d.items).where(isDefined).toArray()));
            const abnormalItems: string[] = _.uniq(_.flatten(group.select(d => d.abnormalItems).where(isDefined).toArray()));
            const count = _.sum(group.select(d => d.count).toArray());
            return {
                entityName: sample.entityName,
                binStartTime, binEndTime, binId,
                items, abnormalItems, count
            }
        });
    return eventBinSeries
}
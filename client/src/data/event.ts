import * as d3 from "d3";
import { DataFrame } from "data-forge";
import { Entity } from "./table";

export type MetaEvent = {
    name: string,
    timestamp: Date,
}

export type IEvent = {
    entityName: string,
    timestamp: Date,
    count: number,
    abnormalyCount?: number,
    items?: string[],
    abnormalItems?: string[]
}

export interface IEventBin {
    entityName: string,
    binId: number,
    binStartTime: Date,
    binEndTime: Date,
    count: number,
    abnormalyCount?: number,
    items?: string[],
    abnormalItems?: string[]
}

export type EventGroup = {
    startTime: Date,
    endTime: Date,
    count: number,
    items: any[]
}

export type Segment = {
    startTime: Date,
    endTime: Date,
    contriSum: number,
    maxValue: number,
    minValue: number
}

export type SegmentExplanation = {
    featureName: string,
    segments: Segment[]
}

export function groupEvents(entity: Entity<number, any>, deltaHour: number) {
    const { time_index, item_index } = entity.metaInfo!;
    let events: EventGroup[] = [];
    if (time_index && item_index) {
        const sortedEntity = entity.parseDates(time_index).orderBy(row => row[time_index]);
        const groups = sortedEntity.groupBy(row => row[item_index]);
        for (const df of groups) {
            const subset = new Entity(df).setMetaInfo(entity.metaInfo!);
            // events = events.concat(TemporalFolding(subset, deltaHour));
            events = events.concat(TemporalLinking(subset, deltaHour));
        }
        let pointEvents = events.filter(e => e.startTime.getTime() === e.endTime.getTime());
        let intervalEvents = events.filter(e => e.startTime.getTime() !== e.endTime.getTime());
        events = itemGrouping(pointEvents, deltaHour, false).concat(itemGrouping(intervalEvents, deltaHour, true));
    }
    return events;
}

const getAccumHour = (date: Date, deltaHour: number) => {
    return Math.floor(date.getTime() / 1000 / 60 / 60 / deltaHour)
}

export function TemporalFolding(
    entity: Entity<number, any>,
    deltaHour: number): EventGroup[] {
    const { time_index, item_index } = entity.metaInfo!;
    return entity.groupBy(row => getAccumHour(row[time_index!], deltaHour))
        .toArray()
        .map(d => ({
            startTime: d.first()[time_index!],
            endTime: d.last()[time_index!],
            count: d.count(),
            items: [d.last()[item_index!]]
        }));
}

export function TemporalLinking(
    entity: Entity<number, any>,
    deltaHour: number): EventGroup[] {
    const { time_index, item_index } = entity.metaInfo!;
    const eventStack: EventGroup[] = [];
    const createPointEvent = (row: any): EventGroup => {
        return {
            startTime: row[time_index!],
            endTime: row[time_index!],
            count: 1,
            items: [row[item_index!]]
        };
    }
    for (const row of entity) {
        if (eventStack.length === 0) {
            eventStack.push(createPointEvent(row));
        }
        else {
            const recentEvent = eventStack.pop();
            const endHour = getAccumHour(recentEvent!.endTime, 1);
            const currentHour = getAccumHour(row[time_index!], 1);
            if (currentHour <= endHour + deltaHour) {
                eventStack.push({
                    startTime: recentEvent!.startTime,
                    endTime: row[time_index!],
                    count: recentEvent!.count + 1,
                    items: [row[item_index!]]
                })
            }
            else {
                eventStack.push(recentEvent!);
                eventStack.push(createPointEvent(row));
            }
        }
    }
    return eventStack;
}

export function itemGrouping(
    eventGroups: EventGroup[],
    deltaHour: number,
    fuzzyMatch: boolean,
): EventGroup[] {
    const df = new DataFrame(eventGroups);
    const groupedDf = fuzzyMatch ? df.groupBy(row => (getAccumHour(row.startTime, deltaHour) << 12)
        + getAccumHour(row.endTime, deltaHour)) :
        df.groupBy(row => (row.startTime.toString() + row.endTime.toString()))
    return groupedDf
        .toArray()
        .map(d => {
            if (d.count() == 1) {
                return d.first()
            }
            else {
                return {
                    startTime: d3.min(d.getSeries<Date>('startTime'))!,
                    endTime: d3.max(d.getSeries<Date>('endTime'))!,
                    count: d3.sum(d.getSeries<number>('count'))!,
                    items: Array.prototype.concat.apply([], d.getSeries('items').toArray()),
                }
            }
        });
}
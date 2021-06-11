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

import { IDataFrame } from "data-forge";

export interface FeatureMeta {
    name: string,
    alias: string,
    primitive?: string,
    entityId: string,
    columnName: string
    where_item: [string, string]|[],
    start_time?: Date,
    end_time?: Date,
}

export interface Feature extends FeatureMeta{
    value: undefined | number | string | Array<any>,
    contribution: number,
    children?: IDataFrame<number, Feature>
}
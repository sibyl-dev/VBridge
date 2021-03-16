import { IDataFrame } from "data-forge";

export interface FeatureMeta {
    name: string,
    alias: string,
    primitive?: string,
    entityId: string,
    columnName: string
    whereItem: [string, string] | [],
    type: 'Surgery Observations' | 'Pre-surgery Observations' | 'Pre-surgery Treatments' | 'Surgery Info' | 'Patient Info'
}

export interface Feature extends FeatureMeta {
    value: undefined | number | string | Array<any>,
    contribution: number,
    children?: IDataFrame<number, Feature>
}
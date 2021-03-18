import { IDataFrame } from "data-forge";

export interface FeatureMeta {
    name?: string,
    alias: string,
    primitive?: string,
    entityId?: string,
    columnName: string
    whereItem: [string, string] | [],
    period: 'in-surgery' | 'pre-surgery',
    type: 'Surgery Observations' | 'Pre-surgery Observations' | 'Pre-surgery Treatments' 
    | 'In-surgery Information' | 'Patient Information'
}

export interface Feature extends FeatureMeta {
    value: undefined | number | string | Array<any>,
    contribution: number,
    children?: IDataFrame<number, Feature>
}
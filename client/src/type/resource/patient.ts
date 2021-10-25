import { PandasDataFrame } from "./_dataframe";

export type PatientStatics = {
    entityId: string,
    items: Record<string, any>
}[];

export type PatientTemporal = Record<string, any>;

export type Patient = {
    static: PatientStatics,
    temporal: PatientTemporal
};

export type PatientGroup = { 
    ids: number[],
    labelCounts: number[], 
};
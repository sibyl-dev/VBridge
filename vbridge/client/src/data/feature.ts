import { IDataFrame } from "data-forge";

export interface FeatureSchema {
    id: string,
    alias: string,
    primitive?: string,
    entityId?: string,
    columnName: string
    whereItem: [string, string] | [],
    period: 'in-surgery' | 'pre-surgery' | 'others',
    type: 'Pre-surgery' | 'In-surgery'
};

export type FeatureSchemaResponse = {
    targets: FeatureSchema[],
    features: FeatureSchema[]
};

export type FeatureValue = Record<string, number | string | Array<any>>;
export type FeatureValueResponse = any;

export interface Feature extends FeatureSchema {
    value: undefined | number | string | Array<any>,
    contribution: number,
    contributionIfNormal?: number,
    predictionIfNormal?: number,
    children?: IDataFrame<number, Feature>,
}

export interface VFeature extends Feature {
    show: boolean
}
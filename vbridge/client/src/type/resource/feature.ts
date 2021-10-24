import { IDataFrame } from "data-forge";
import { PandasDataFrame } from "./_dataframe";

export interface FeatureSchema {
    id: string,
    alias: string,
    primitive?: string,
    entityId: string,
    columnId: string
    item?: {
        columnId: string,
        itemId: string,
        itemAlias?: string,
    },
    parentId?: number,
    childrenIds?: number[]
};
export type FeatureSchemaResponse = FeatureSchema[];

export type FeatureValue = Record<string, number | string>;

export type FeatureValueResponse = string;
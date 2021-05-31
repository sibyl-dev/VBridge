import { DataFrame } from "data-forge"
import { DataFrameConfigFn, IDataFrameConfig } from "data-forge/build/lib/dataframe";

// export type columnType = 'numerical' | 'categorical' | 'timestamp';
export type ItemDesc = {
    LABEL: string,
    LABEL_CN: string
};

export type ItemDict = Record<string, ItemDesc>;

export interface EntitySchema {
    id: string,
    alias?: string,
    time_index?: string,
    item_index?: string,
    value_indexes?: string[],
    types?: ('numerical' | 'categorical' | 'timestamp')[],
    item_dict?: ItemDict
}

export type EntitySetSchema = EntitySchema[];

export class Entity<IndexT, ValueT> extends DataFrame<IndexT, ValueT> {
    public id: string;
    public schema: EntitySchema;

    constructor(schema: EntitySchema, config?: Iterable<ValueT> | IDataFrameConfig<IndexT, ValueT>
        | DataFrameConfigFn<IndexT, ValueT> | DataFrame<IndexT, ValueT>) {
        super(config);
        this.id = schema.id;
        this.schema = schema;
    }
}

export type StatValues = {
    mean: number,
    std: number,
    count: number,
    ci95: [number, number],
}

export type itemId = string;
export type columnId = string;
export type entityId = string;

export type ReferenceValues = Record<itemId, Record<columnId, StatValues>>;

export type ReferenceValueResponse = Record<entityId, ReferenceValues>;
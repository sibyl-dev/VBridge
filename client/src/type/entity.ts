import { DataFrame } from "data-forge"
import { DataFrameConfigFn, IDataFrameConfig } from "data-forge/build/lib/dataframe";
import { EntitySchema, PandasDataFrame } from "./resource";


export class Entity<IndexT, ValueT> extends DataFrame<IndexT, ValueT> {
    public id: string;
    public schema: EntitySchema;

    constructor(schema: EntitySchema, config?: Iterable<ValueT> | IDataFrameConfig<IndexT, ValueT>
        | DataFrameConfigFn<IndexT, ValueT> | DataFrame<IndexT, ValueT>) {
        super(config);
        this.id = schema.entityId;
        this.schema = schema;
    }
    
}
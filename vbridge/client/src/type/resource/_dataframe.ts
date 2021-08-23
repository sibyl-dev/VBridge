import { IDataFrameConfig } from "data-forge/build/lib/dataframe";

export type PandasDataFrame<IndexT, ValueT> = {
    index: Iterable<IndexT>,
    columns: Iterable<string>,
    data: Iterable<ValueT>,
}

export function PandasDataFrame2DataForge<IndexT, ValueT>(
    dataframe: PandasDataFrame<IndexT, ValueT>): IDataFrameConfig<IndexT, ValueT> {
    return {
        index: dataframe.index,
        columnNames: dataframe.columns,
        values: dataframe.data
    }
}
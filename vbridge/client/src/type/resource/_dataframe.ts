import { DataFrame, IDataFrame } from "data-forge/build/lib/dataframe";

export type PandasDataFrame<IndexT> = {
    index: Iterable<IndexT>,
    columns: Array<string>,
    data: Array<Array<any>>,
}

export function PandasDataFrame2DataForge<IndexT, ValueT>(
    dataframe: PandasDataFrame<IndexT>): IDataFrame<IndexT, ValueT> {
    const df = new DataFrame({
        values: dataframe.data,
        index: dataframe.index,
    });
    // return {
    //     index: dataframe.index,
    //     columnNames: dataframe.columns,
    //     values: dataframe.data
    // }
    const columnNames = dataframe.columns;
    return df.select(row => {
        const dict: any = {};
        row.forEach((ele, i) => dict[columnNames[i]] = ele)
        return dict as ValueT
    })
    // return df;
}

import { DataFrame } from "data-forge"
import { DataFrameConfigFn, IDataFrameConfig } from "data-forge/build/lib/dataframe";
import { Index } from "react-virtualized";

// export type columnType = 'numerical' | 'categorical' | 'timestamp';

export interface TableMeta {
    name?: string,
    time_index?: string,
    types?: ('numerical' | 'categorical' | 'timestamp')[],
    item_index?: string,
    value_indexes?: string[],
    alias?: string,
}

export class Entity<IndexT, ValueT> extends DataFrame<IndexT, ValueT> {
    public metaInfo?: TableMeta;
    public name?: string;
    public timeIndex?: string;

    constructor(config?: Iterable<ValueT> | IDataFrameConfig<IndexT, ValueT>
        | DataFrameConfigFn<IndexT, ValueT> | DataFrame<IndexT, ValueT>) {
        super(config);

        this.columnWidth = this.columnWidth.bind(this);
    }

    public setMetaInfo(metaInfo: TableMeta) {
        this.metaInfo = metaInfo;
        return this;
    }

    public update() {
        if (this.metaInfo !== undefined) {
            const { name, time_index, types } = this.metaInfo;
            this.name = name;
            this.timeIndex = time_index;

            time_index && this.parseDates(time_index);
            types && this.getColumnNames().forEach((name, i) => {
                if (types[i] === 'numerical') {
                    this.parseFloats(name);
                }
                else if (types[i] === 'timestamp') {
                    this.parseDates(name);
                }
            })
        }
        return this;
    }

    public columnWidth(includeIndex?: boolean,
        maxWidth?: number, minWidth?: number) {
        return ((params: Index) => {
            let columnIndex = params.index;
            if (!includeIndex) {
                columnIndex += 1;
            }
            const column = this.getColumns().at(columnIndex);
            const columnContent = column?.series.toArray();
            columnContent?.push(column?.name);
            const charLength = columnContent?.map(d => String(d).length);
            let estLength = charLength && Math.max.apply(this, charLength) * 10 + 5;
            if (maxWidth !== undefined && estLength)
                estLength = Math.min(maxWidth, estLength);
            if (minWidth !== undefined && estLength)
                estLength = Math.max(minWidth, estLength);
            return estLength || 120;
        })
    }
}
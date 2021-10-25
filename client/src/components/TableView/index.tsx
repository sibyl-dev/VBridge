import * as React from "react";
import * as dataForge from "data-forge"
import PureTable from "../Table"

import './index.css'
import { Entity } from "type";

export interface TableMeta {
    entityId: string,
    startTime?: Date,
    endTime?: Date,
    itemList?: string[],
}

export interface TableViewProps {
    tableRecords: Entity<number, any>[]
    tableMeta: TableMeta,
}

export interface TableViewStates {
    records?: dataForge.IDataFrame<number, any>;
}

export default class TableView extends React.Component<TableViewProps, TableViewStates> {

    constructor(props: TableViewProps) {
        super(props);
        this.state = {};

        this.updateData = this.updateData.bind(this);
    }

    componentDidMount() {
        this.updateData();
    }

    componentDidUpdate(prevProps: TableViewProps) {
        const { tableMeta } = this.props;
        if (prevProps.tableMeta !== tableMeta) {
            this.updateData();
        }
    }

    private updateData() {
        const { tableMeta, tableRecords } = this.props;
        const { entityId: tableName, startTime, endTime, itemList } = tableMeta;
        let table = tableRecords.find(e => e.id === tableName);

        if (table) {
            const { time_index, item_index, item_dict } = table.schema;
            let records: dataForge.IDataFrame = table;
            if (itemList) {
                records = records.where(d => itemList.includes(d[item_index!]))!
            }
            if (startTime) {
                records = records.where(d => new Date(d[time_index!]) >= startTime);
            }
            if (endTime) {
                records = records.where(d => new Date(d[time_index!]) <= endTime);
            }
            records = records.resetIndex();
            if (item_dict) {
                records = records.select(row => {
                    const newRow = { ...row };
                    newRow[item_index!] = item_dict[row[item_index!]]
                    return newRow
                })
            }
            this.setState({ records })
        }
    }

    public render() {
        const { records } = this.state;

        return <div style={{ height: "100%", width: "100%" }}>
            {records && <PureTable
                dataFrame={records}
                drawIndex={false}
            />}
        </div>
    }
}
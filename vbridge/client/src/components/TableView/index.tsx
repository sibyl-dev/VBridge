import * as React from "react";
import * as dataForge from "data-forge"
import PureTable from "../Table"
import { Entity, ItemDict } from "data/entity";
import { PatientStatics } from "data/patient";
import { FeatureSchema } from "data/feature";

import './index.css'

export interface TableMeta {
    tableName: string,
    startTime: Date,
    endTime: Date,
    itemList: string[],
}

export interface TableViewProps {
    patientMeta?: PatientStatics,
    featureMeta: dataForge.IDataFrame<number, FeatureSchema>,
    tableNames: string[],
    tableRecords: Entity<number, any>[]
    tableMeta: TableMeta,
    itemDicts?: ItemDict,
}

export interface TableViewStates {
    tableRecord?: dataForge.IDataFrame<number, any>;
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
        const { tableMeta, tableRecords, itemDicts } = this.props;
        const { tableName, startTime, endTime, itemList } = tableMeta;
        const table = tableRecords?.find(e => e.id === tableName);

        if (table) {
            const { time_index, item_index } = table.schema!;
            let tableRecord = table.where(d => new Date(d[time_index!]) <= endTime
                && new Date(d[time_index!]) >= startTime
                && itemList.includes(d[item_index!])).resetIndex();
            console.log(tableMeta, tableRecord.toArray());
            // if (itemDicts) {
            //     tableRecord = tableRecord.select(row => {
            //         const newRow = { ...row };
            //         newRow[item_index!] = itemDicts(tableName, row[item_index!])?.LABEL
            //         return newRow
            //     })
            //     console.log(tableRecord.toArray());
            // }
            this.setState({ tableRecord })
        }
    }

    public render() {
        const { tableRecord } = this.state;

        return <div style={{ height: "100%", width: "100%" }}>
            {tableRecord && <PureTable
                dataFrame={tableRecord}
                drawIndex={false}
            />}
        </div>
    }
}
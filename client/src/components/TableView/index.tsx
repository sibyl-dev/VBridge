import * as React from "react";
import * as dataForge from "data-forge"
import { Select, Table } from "antd"

import Panel from "../Panel"
import PureTable from "../Table"
import { getPatientRecords } from "../../router/api"
import { Entity, ItemDict } from "data/table";
import { PatientMeta } from "data/patient";
import { groupEvents } from "data/event";
import { FeatureMeta } from "data/feature";

import './index.css'

export interface TableMeta {
    tableName: string,
    startTime: Date,
    endTime: Date,
    itemList: string[],
}

export interface TableViewProps {
    patientMeta?: PatientMeta,
    featureMeta: dataForge.IDataFrame<number, FeatureMeta>,
    tableNames: string[],
    tableRecords: Entity<number, any>[]
    tableMeta: TableMeta,
    itemDicts?: ItemDict,
}

export interface TableViewStates {
    tableRecord?: dataForge.IDataFrame<number, any>;
    // tableRecord?: any[][],
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
        const table = tableRecords?.find(e => e.name === tableName);

        if (table) {
            const { time_index, item_index } = table.metaInfo!;
            let tableRecord = table.where(d => new Date(d[time_index!]) <= endTime
                && new Date(d[time_index!]) >= startTime
                && itemList.includes(d[item_index!])).resetIndex();
            console.log(tableMeta, tableRecord.toArray());
            if (itemDicts) {
                tableRecord = tableRecord.select(row => {
                    const newRow = { ...row };
                    newRow[item_index!] = itemDicts(tableName, row[item_index!])?.LABEL
                    return newRow
                })
                console.log(tableRecord.toArray());
            }
            // this.setState({ tableRecord: tableRecord.toArray() })
            this.setState({ tableRecord})
        }
    }

    public render() {
        const { tableNames } = this.props;
        const { tableRecord } = this.state;

        return <div style={{ height: "100%", width: "100%" }}>
            {tableRecord && <PureTable
                    dataFrame={tableRecord}
                    // dataFrame={this.props.tableRecords[0]}
                    drawIndex={false}
                />}
        </div>
    }
}
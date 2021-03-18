import * as React from "react";
import * as dataForge from "data-forge"
import { Select, Table } from "antd"

import Panel from "../Panel"
import PureTable from "../Table"
import { getPatientRecords } from "../../router/api"
import { Entity } from "data/table";
import { PatientMeta } from "data/patient";
import { groupEvents } from "data/event";
import { FeatureMeta } from "data/feature";

const { Option } = Select

export interface TableViewProps {
    patientMeta?: PatientMeta,
    featureMeta: dataForge.IDataFrame<number, FeatureMeta>,
    tableNames: string[]
}

export interface TableViewStates {
    tableRecords?: Entity<number, any>
}

export default class TableView extends React.Component<TableViewProps, TableViewStates> {

    constructor(props: TableViewProps) {
        super(props);
        this.state = {}
        this.loadPatientRecords = this.loadPatientRecords.bind(this);
    }

    componentDidUpdate(prevProps: TableViewProps) {
        if (prevProps.patientMeta?.subjectId !== this.props.patientMeta?.subjectId) {
            this.setState({tableRecords: undefined});
        }
    }

    private async loadPatientRecords(tableName: string) {
        const { patientMeta } = this.props;
        if (patientMeta === undefined) return;
        const records = await getPatientRecords({ table_name: tableName, subject_id: patientMeta.subjectId });
        this.setState({ tableRecords: records });
    }

    public render() {
        const { tableNames } = this.props;
        const { tableRecords } = this.state;

        return (
            <div style={{height: "100%", width: "100%"}}>
                <Select style={{ width: 240 }} onChange={this.loadPatientRecords}>
                    {tableNames.map((name, i) => (<Option value={name} key={i}>{name}</Option>))}
                </Select>
                {tableRecords && <PureTable
                    dataFrame={tableRecords}
                    drawIndex={false}
                />}

            </div>
        )
    }
}
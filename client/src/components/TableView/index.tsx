import * as React from "react";
import * as dataForge from "data-forge"
import { Select, Table } from "antd"

import Panel from "../Panel"
import PureTable from "../Table"
import { getPatientRecords } from "../../router/api"

const { Option } = Select

export interface TableViewProps {
    subjectId?: number,
    tableNames: string[]
}

export interface TableViewStates {
    tableRecords?: dataForge.DataFrame<number, any>
}

export default class TableView extends React.Component<TableViewProps, TableViewStates> {

    constructor(props: TableViewProps) {
        super(props);
        this.state = {}
        this.loadPatientRecords = this.loadPatientRecords.bind(this);
    }

    private async loadPatientRecords(tableName: string) {
        const { subjectId } = this.props;
        if (subjectId === undefined) return;
        const records = await getPatientRecords({ table_name: tableName, subject_id: subjectId });
        this.setState({ tableRecords: records });
    }

    public render() {
        const { tableNames } = this.props;
        const { tableRecords } = this.state;

        return (
            <Panel initialWidth={600} initialHeight={435} x={1010} y={265}>
                <Select style={{ width: 240 }} onChange={this.loadPatientRecords}>
                    {tableNames.map((name, i) => (<Option value={name} key={i}>{name}</Option>))}
                </Select>
                {tableRecords && <PureTable
                    dataFrame={tableRecords}
                    drawIndex={false}
                />}

            </Panel>
        )
    }
}
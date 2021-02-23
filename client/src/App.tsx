import React from 'react';
import { Layout } from 'antd'
import './App.css';

import FeatureView from "./components/FeatureView"
import MetaView from "./components/MetaView"
import TableView from "./components/TableView"
import TimelineView from "./components/TimelineView"
import DynamicView from "./components/DynamicView"
import { getPatientIds, getPatientMeta, getPatientRecords, getTableNames } from "./router/api"
import { PatientMeta } from 'data/patient';
import { Entity } from 'data/table';

const { Header, Content } = Layout

interface AppProps {

}

interface AppStates {
  subjectIds?: number[],
  patientMeta?: PatientMeta,
  tableNames?: string[],
  tableRecords?: Entity<number, any>[]
}

class App extends React.Component<AppProps, AppStates>{
  constructor(props: AppProps) {
    super(props);
    this.state = {};

    this.selectPatientId = this.selectPatientId.bind(this);
    this.loadPatientRecords = this.loadPatientRecords.bind(this);
  }

  public async init() {
    const subjectIds = await getPatientIds();
    const tableNames = await getTableNames();

    // const patientMeta = (subjectIds.length > 0) ?
    //   await getPatientMeta({ subject_id: subjectIds[0] }) : undefined;
    this.setState({ subjectIds, tableNames });
  }

  public async selectPatientId(subjectId: number) {
    const patientMeta = await getPatientMeta({ subject_id: subjectId });
    const tableRecords = await this.loadPatientRecords(subjectId);
    this.setState({ patientMeta, tableRecords });
  }

  private async loadPatientRecords(subjectId: number) {
    const { tableNames } = this.state;
    const tableRecords: Entity<number, any>[] = []
    if (tableNames)
      for (let tableName of tableNames) {
        const records = await getPatientRecords({ table_name: tableName, subject_id: subjectId });
        tableRecords.push(records)
      }
    return tableRecords
  }

  public componentDidMount() {
    this.init();
  }

  public render() {
    const { subjectIds, patientMeta, tableNames, tableRecords } = this.state
    return (
      <div className='App'>
        <Layout>
          <Header>
            <p className='system-name'>Bridges</p>
          </Header>
          <Content>
            <FeatureView />
            <TimelineView
              patientMeta={patientMeta}
              tableRecords={tableRecords}
            />
            {tableNames && <MetaView
              patientIds={subjectIds}
              selectPatientId={this.selectPatientId}
            />}
            <DynamicView
              patientMeta={patientMeta}
              tableNames={tableNames}
              tableRecords={tableRecords}
            />
            {tableNames && <TableView
              patientMeta={patientMeta}
              tableNames={tableNames}
            />}
          </Content>
        </Layout>
      </div>
    )
  }
}

export default App;

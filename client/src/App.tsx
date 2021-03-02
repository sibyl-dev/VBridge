import React from 'react';
import { Layout } from 'antd'
import './App.css';

import FeatureView from "./components/FeatureView"
import MetaView from "./components/MetaView"
import TableView from "./components/TableView"
import TimelineView from "./components/TimelineView"
import DynamicView from "./components/DynamicView"
import { getFeatureMate, getPatientIds, getPatientMeta, getPatientRecords, getPredictionTargets, getTableNames } from "./router/api"
import { PatientMeta } from 'data/patient';
import { Entity } from 'data/table';
import Panel from 'components/Panel';
import { FeatureMeta } from 'data/feature';
import { DataFrame } from 'data-forge';

const { Header, Content } = Layout

interface AppProps {

}

interface AppStates {
  subjectIds?: number[],
  patientMeta?: PatientMeta,
  tableNames?: string[],
  tableRecords?: Entity<number, any>[],

  featureMeta?: DataFrame<number, FeatureMeta>,
  predictionTargets?: string[]
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

    const featureMeta = new DataFrame(await getFeatureMate());
    const predictionTargets = await getPredictionTargets();

    this.setState({ subjectIds, tableNames, featureMeta, predictionTargets });
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
    const { subjectIds, patientMeta, tableNames, tableRecords, featureMeta, predictionTargets } = this.state
    return (
      <div className='App'>
        <Layout>
          <Header>
            <p className='system-name'>Bridges</p>
          </Header>
          <Content>
            <Panel initialWidth={400} initialHeight={840} x={0} y={0}>
              {featureMeta && predictionTargets&&  <FeatureView
                patientMeta={patientMeta}
                featureMeta={featureMeta}
                predictionTargets={predictionTargets}
              />}
            </Panel>
            <Panel initialWidth={700} initialHeight={400} x={405} y={0}>
              <TimelineView
                patientMeta={patientMeta}
                tableRecords={tableRecords}
              />
            </Panel>
            {tableNames && <Panel initialWidth={300} initialHeight={400} x={1110} y={0}>
              <MetaView
                patientIds={subjectIds}
                selectPatientId={this.selectPatientId}
              />
            </Panel>
            }
            <Panel initialWidth={600} initialHeight={435} x={405} y={405}>
              <DynamicView
                patientMeta={patientMeta}
                tableNames={tableNames}
                tableRecords={tableRecords}
              />
            </Panel>
            {tableNames && <Panel initialWidth={400} initialHeight={435} x={1010} y={405}>
              <TableView
                patientMeta={patientMeta}
                tableNames={tableNames}
              />
            </Panel>
            }
          </Content>
        </Layout>
      </div>
    )
  }
}

export default App;

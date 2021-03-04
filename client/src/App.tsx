import React from 'react';

import { Layout } from 'antd'
import './App.css';

import FeatureView from "./components/FeatureView"
import MetaView from "./components/MetaView"
import TableView from "./components/TableView"
import TimelineView from "./components/TimelineView"
import DynamicView from "./components/DynamicView"
import FilterView from "./components/FilterView"

import { getPatientIds, getPatientMeta, getPatientInfoMeta, getPatientRecords, getTableNames, getPatientFilterRange, getPatientGroup } from "./router/api"
import { PatientMeta } from 'data/patient';
import { Entity } from 'data/table';
import {patientInfoMeta} from 'data/metaInfo';
import {filterType} from 'data/filterType';



import Panel from 'components/Panel';

const { Header, Content } = Layout

interface AppProps {

}

interface AppStates {
  subjectIds?: number[],
  patientMeta?: PatientMeta,
  tableNames?: string[],
  tableRecords?: Entity<number, any>[],
  patientInfoMeta?: {[key: string]: any},
  filterRange?: filterType,
  filterConditions?: {[key: string]: any},
}

class App extends React.Component<AppProps, AppStates>{
  constructor(props: AppProps) {
    super(props);
    this.state = {};

    this.selectPatientId = this.selectPatientId.bind(this);
    this.loadPatientRecords = this.loadPatientRecords.bind(this);
    this.filterPatients = this.filterPatients.bind(this)
  }

  public async init() {
    const subjectIds = await getPatientIds();
    const tableNames = await getTableNames();
    const filterRange = await getPatientFilterRange();
    const filterConditions ={'':''}
    // const patientMeta = (subjectIds.length > 0) ?
    //   await getPatientMeta({ subject_id: subjectIds[0] }) : undefined;
    this.setState({ subjectIds, tableNames, filterRange, filterConditions});
  }

  public async selectPatientId(subjectId: number) {
    const patientMeta = await getPatientMeta({ subject_id: subjectId });
    const patientInfoMeta = await getPatientInfoMeta({subject_id: subjectId});
    // const admissionInfoMeta:admissionInfoMeta = JSON.parse(await getPatientInfoMeta({ subject_id: subjectId, table_name: 'ADMISSIONS'}));
    // const surgeryInfoMeta:surgeryInfoMeta = JSON.parse(await getPatientInfoMeta({ subject_id: subjectId, table_name: 'SURGERY_INFO'}));

    const tableRecords = await this.loadPatientRecords(subjectId);
    console.log('selectPatientId', patientMeta, tableRecords)
    // console.log('meta', admissionInfoMeta, surgeryInfoMeta)
    // console.log('meta', patientInfoMeta['GENDER'])
    // patientInfoMeta, admissionInfoMeta, surgeryInfoMeta 
    this.setState({patientMeta, tableRecords, patientInfoMeta});
  }

  public async filterPatients(conditions: {[key: string]: any}) {
    const {filterConditions, filterRange} = this.state
    for(var key in conditions)
      if(filterConditions){
        var value = conditions[key]=='Yes'?1: conditions[key]
        value = conditions[key]=='No'?0: conditions[key]
        filterConditions[key] = value
      }
    this.setState({filterConditions})

    if(filterConditions)
      getPatientGroup({ filterConditions: filterConditions })
    console.log('conditions', filterConditions)

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
    const { subjectIds, patientMeta, tableNames, tableRecords, patientInfoMeta, filterRange } = this.state
    return (
      <div className='App'>
        <Layout>
          <Header>
            <p className='system-name'>Bridges</p>
          </Header>
          <Content>
            <Panel initialWidth={400} initialHeight={840} x={0} y={0}>
              <FeatureView />
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
                patientInfoMeta={patientInfoMeta}
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
            {tableNames && <Panel initialWidth={400} initialHeight={835} x={1410} y={0}>
              <FilterView
                patientIds={subjectIds}
                filterRange={filterRange}
                filterPatients={this.filterPatients}
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

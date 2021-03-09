import React from 'react';

import { Layout, Select } from 'antd'
import './App.css';

import FeatureView from "./components/FeatureView"
import MetaView from "./components/MetaView"
import TableView from "./components/TableView"
import TimelineView from "./components/TimelineView"

import DynamicView, { RecordTS } from "./components/DynamicView"
import FilterView from "./components/FilterView"

import { getFeatureMate, getPatientIds, getPatientMeta, getPatientInfoMeta, getPatientRecords, getPredictionTargets, getTableNames, getPatientFilterRange, getPatientGroup, getItemDict } from "./router/api"
import { PatientMeta } from 'data/patient';
import { Entity, ItemDict } from 'data/table';
import { patientInfoMeta } from 'data/metaInfo';
import { filterType } from 'data/filterType';

import Panel from 'components/Panel';
import { FeatureMeta } from 'data/feature';
import { DataFrame } from 'data-forge';
import { isUndefined } from 'lodash';
import { isDefined } from 'data/common';

const { Header, Content } = Layout;
const { Option } = Select;

interface AppProps { }

interface AppStates {
  // static information
  subjectIds?: number[],
  tableNames?: string[],
  featureMeta?: DataFrame<number, FeatureMeta>,
  predictionTargets?: string[],
  itemDicts?: ItemDict,

  //patient information
  tableRecords?: Entity<number, any>[],
  patientMeta?: PatientMeta,

  //for view communication
  dynamicRecords: RecordTS[]

  patientInfoMeta?: { [key: string]: any },
  filterRange?: filterType,
  filterConditions?: {[key: string]: any},
  subjectIdG?: object,
}

class App extends React.Component<AppProps, AppStates>{
  constructor(props: AppProps) {
    super(props);
    this.state = { dynamicRecords: [] };

    this.selectPatientId = this.selectPatientId.bind(this);
    this.loadPatientRecords = this.loadPatientRecords.bind(this);
    this.filterPatients = this.filterPatients.bind(this)
    this.buildRecordTS = this.buildRecordTS.bind(this);
    this.updateRecordTS = this.updateRecordTS.bind(this);
    this.buildRecordTSFromFeature = this.buildRecordTSFromFeature.bind(this);
  }

  public componentDidMount() {
    this.init();
  }

  public componentDidUpdate(prevProps: AppProps, prevState: AppStates) {
    if (prevState.patientMeta?.subjectId !== this.state.patientMeta?.subjectId) {
      const { featureMeta } = this.state;
      if (featureMeta) {
        const dynamicRecords = featureMeta.toArray().map(row => this.buildRecordTSFromFeature(row)).filter(isDefined);
        this.setState({ dynamicRecords });
      }
    }
  }

  public async init() {
    const subjectIds = await getPatientIds();
    const tableNames = await getTableNames();
    const filterRange = await getPatientFilterRange();
    const itemDicts = await getItemDict();
    const filterConditions = { '': '' }

    const featureMeta = new DataFrame(await getFeatureMate());
    const predictionTargets = await getPredictionTargets();

    const subjectIdG = (await getPatientGroup({ filterConditions: filterConditions })).subject_idG

    this.setState({ subjectIds, tableNames, filterRange, filterConditions, featureMeta, predictionTargets, itemDicts });
  }

  public async selectPatientId(subjectId: number) {
    const patientMeta = await getPatientMeta({ subject_id: subjectId });
    const patientInfoMeta = await getPatientInfoMeta({ subject_id: subjectId });
    const tableRecords = await this.loadPatientRecords(subjectId);
    this.setState({ patientMeta, tableRecords, patientInfoMeta });
  }

  public async filterPatients(conditions: {[key: string]: any}, checkedAll: boolean) {
    const {filterConditions, filterRange} = this.state
    for(var key in conditions)
      if(filterConditions){
        var value = conditions[key]=='Yes'?1: conditions[key]
        value = conditions[key]=='No'?0: conditions[key]
        filterConditions[key] = value

      if(checkedAll)
          delete filterConditions[key]
      }
    this.setState({ filterConditions })

    var subjectIdG:{[key: string]: any} = {}
    if(filterConditions){
      subjectIdG = (await getPatientGroup({ filterConditions: filterConditions })).subject_idG
      this.setState({subjectIdG})
    }

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

  private buildRecordTSFromFeature(feature: FeatureMeta): RecordTS | undefined {
    const { entityId, where_item, start_time, end_time, columnName } = feature;
    console.log(entityId);
    const entity = this.state.tableRecords?.find(e => e.name === entityId);
    if (entity?.metaInfo) {
      const { item_index, time_index } = entity.metaInfo;
      if (item_index && time_index)
        return {
          tableName: entityId,
          columnName: columnName,
          itemName: where_item[1] as string,
          startTime: start_time,
          endTime: end_time,
        }
    }
    else return undefined
  }

  private buildRecordTS(entityName: string, startDate: Date, endDate: Date): RecordTS[] {
    const entity = this.state.tableRecords?.find(e => e.name === entityName);
    const { item_index, time_index, value_indexes } = entity?.metaInfo!;
    if (entity && item_index && time_index && value_indexes && value_indexes.length > 0) {
      const selectedDf = entity.where(row => startDate < new Date(row[time_index]) && new Date(row[time_index]) < endDate)
        .groupBy(row => (row[item_index]));
      let records: RecordTS[] = [];
      for (const itemDf of selectedDf) {
        const itemRecords: RecordTS[] = value_indexes.map(value_index => {
          return {
            tableName: entity.name!,
            columnName: value_index,
            itemName: itemDf.first()[item_index],
            startDate: startDate,
            endDate: endDate,
          }
        })
        records = [...records, ...itemRecords]
      }
      return records;
    }
    else
      return [];
  }

  private updateRecordTS(entityName: string, startDate: Date, endDate: Date) {
    const newRecords = this.buildRecordTS(entityName, startDate, endDate);
    this.setState({ dynamicRecords: newRecords });
  }

  public render() {
    const { subjectIds, patientMeta, tableNames, tableRecords, featureMeta, predictionTargets,
      itemDicts, dynamicRecords, patientInfoMeta, filterRange } = this.state
    return (
      <div className='App'>
        <Layout>
          <Header>
            <p className='system-name'>Bridges</p>
            <span className="patient-selector-title">PatientId: </span>
            <Select style={{ width: 120 }} onChange={this.selectPatientId} className="patient-selector">
              {subjectIds && subjectIds.map((id, i) =>
                <Option value={id} key={i}>{id}</Option>
              )}
            </Select>
          </Header>
          <Content>
            <Panel initialWidth={400} initialHeight={840} x={0} y={0} title="Feature View">
              {featureMeta && predictionTargets && tableNames && <FeatureView
                patientMeta={patientMeta}
                featureMeta={featureMeta}
                predictionTargets={predictionTargets}
                tableNames={tableNames}
                itemDicts={itemDicts}
              />}
            </Panel>
            <Panel initialWidth={800} initialHeight={260} x={405} y={0} title="Timeline View">
              <TimelineView
                patientMeta={patientMeta}
                tableRecords={tableRecords}
                onSelectEvents={this.updateRecordTS}
              />
            </Panel>
            <Panel initialWidth={800} initialHeight={575} x={405} y={265} title="Signal View">
              {patientMeta && tableRecords && <DynamicView
                patientMeta={patientMeta}
                tableRecords={tableRecords}
                dynamicRecords={dynamicRecords}
                itemDicts={itemDicts}
              />}
            </Panel>
            {tableNames && <Panel initialWidth={300} initialHeight={840} x={1210} y={0} title="Patient View">
              <MetaView
                patientIds={subjectIds}
                patientInfoMeta={patientInfoMeta}
              />
            </Panel>
            }
            {/* {tableNames && <Panel initialWidth={400} initialHeight={435} x={1010} y={405}>
              <TableView
                patientMeta={patientMeta}
                tableNames={tableNames}
              />
            </Panel>
            }*/}
             {/* {tableNames && <Panel initialWidth={400} initialHeight={835} x={1410} y={0}>
              <FilterView
                patientIds={subjectIds}
                filterRange={filterRange}
                filterPatients={this.filterPatients}
              />
            </Panel>
            }  */}
          </Content>
        </Layout>
      </div>
    )
  }
}

export default App;

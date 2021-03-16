import React from 'react';

import { Layout, Drawer, Tooltip, Button, Select, Avatar, Divider, Row, Col} from 'antd'
import { FilterOutlined} from '@ant-design/icons'
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
import ReactEcharts  from 'echarts-for-react';


import Panel from 'components/Panel';
import { FeatureMeta } from 'data/feature';
import { DataFrame } from 'data-forge';
import { isUndefined } from 'lodash';
import { isDefined } from 'data/common';

import Histogram from "visualization/Histogram";
import {getScaleLinear} from "visualization/common";



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
  subjectIdG?: {[key: string]: any},
  selectedsubjectId?: number,
  conditions?: {[key: string]: any},
  visible?: boolean,
}

class App extends React.Component<AppProps, AppStates>{
  constructor(props: AppProps) {
    super(props);
    this.state = { dynamicRecords: [], conditions:{'':''}};

    this.selectPatientId = this.selectPatientId.bind(this);
    this.selectComparePatientId = this.selectComparePatientId.bind(this)
    this.loadPatientRecords = this.loadPatientRecords.bind(this);
    this.filterPatients = this.filterPatients.bind(this)
    this.buildRecordTS = this.buildRecordTS.bind(this);
    this.updateRecordTS = this.updateRecordTS.bind(this);
    this.showDrawer = this.showDrawer.bind(this)
    this.onClose = this.onClose.bind(this)
    this.buildRecordTSFromFeature = this.buildRecordTSFromFeature.bind(this);
  }

  componentDidMount() {
    this.init();
  }

  componentDidUpdate(prevProps: AppProps, prevState: AppStates) {
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

    const featureMeta = new DataFrame(await getFeatureMate());
    const predictionTargets = await getPredictionTargets();

    const subjectIdG = (await getPatientGroup({filterConditions: { '': '' }, subject_id:0}))
    // const prediction = (await getPatientGroup({ filterConditions: filterConditions })).prediction
    console.log('init', subjectIdG, filterRange)
    this.setState({ subjectIds, tableNames, filterRange, featureMeta, predictionTargets, itemDicts, subjectIdG});
  }

  public async selectPatientId(subjectId: number) {
    const selectedsubjectId = subjectId
    const patientMeta = await getPatientMeta({ subject_id: subjectId });
    const patientInfoMeta = await getPatientInfoMeta({ subject_id: subjectId });
    const tableRecords = await this.loadPatientRecords(subjectId);
    if(this.state.conditions){
      const subjectIdG = (await getPatientGroup({filterConditions: this.state.conditions, subject_id: subjectId}))
      this.setState({subjectIdG})
    }
    this.setState({ patientMeta, tableRecords, patientInfoMeta, selectedsubjectId});
  }
  public async selectComparePatientId(subjectId: number){

  }

  private async filterPatients(conditions: {[key: string]: any}, changeornot:boolean) {
    if(changeornot && this.state.selectedsubjectId){
        const subjectIdG = (await getPatientGroup({filterConditions: conditions, subject_id: this.state.selectedsubjectId}))
        this.setState({subjectIdG:subjectIdG, conditions: Object.assign({}, conditions)})
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
  private showDrawer = () => {
    const visible = true
    this.setState({visible})
  };
  private onClose = () => {
    const visible = false
    this.setState({visible})
    // console.log('onClose', this.state.filterConditions)
  };

  public render() {

    const { subjectIds, patientMeta, tableNames, tableRecords, featureMeta, predictionTargets,
      itemDicts, dynamicRecords, patientInfoMeta, filterRange, visible, subjectIdG } = this.state
    console.log('render', subjectIdG)
    const idGs: number [] = subjectIdG && subjectIdG.subject_idG.slice(0, 100)
    const predictionG: string[] = subjectIdG && subjectIdG.predictionG.slice(0, 100)  
    const similarityG:number [] = subjectIdG && subjectIdG.similarity && subjectIdG.similarity.slice(0, 100)
    console.log('predictionG', predictionG)
    const complicationtypes = ['Lung Comp.','Cardiac Comp.','Arrhythmia Comp.','Infectious Comp.','Other Comp.', 'No Comp.']
    const brieftcomplitype = ['L', 'C', 'A', 'I', 'O']
    const distribution:number [] = subjectIdG && subjectIdG.distribution
    if(distribution)
      var x = getScaleLinear(0, 100, distribution);

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
           
            <Tooltip title="Filter">
              <Button type="primary" shape="circle" icon={<FilterOutlined />} onClick={this.showDrawer} style={{marginLeft:'20px', zIndex:1}}/>
            </Tooltip>
            <span className="patient-selector-title" style={{marginLeft:'20px'}}> Filtred Result: {subjectIdG && subjectIdG.subject_idG? subjectIdG.subject_idG.length:0} </span>
            <span className="patient-selector-title" style={{marginLeft:'20px'}}> Prediction outcome: </span>
            
             <Select mode="multiple" allowClear
                                      placeholder="Please select"
                                      maxTagCount='responsive'
                                      dropdownMatchSelectWidth={true}
                                      style={{ width: '300px' }} onChange={this.selectComparePatientId} className="compare-patient-selector">
              {distribution && distribution.map((number, i) => 
                <>
                 <Option value={number} key={i} >
                   <div style={{width: '50%'}}> {complicationtypes[i]} </div>
                   <div className="number" style={{ width: '40%', opacity: Math.max(1 , 0.5) }}>
                       <div className="neg-feature" style={{width: x(number)}} />  
                   </div>
                   <div style={{width: '10%'}}> {number} </div>

                  </Option>
                 </>
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
                subjectIdG={subjectIdG && subjectIdG.subject_idG}
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
                subjectIdG={subjectIdG && subjectIdG.subject_idG}
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
             {tableNames && 
              <Drawer title="Filter View" placement="right" closable={false} onClose={this.onClose} visible={visible} width={450} >
              <p>
                  <FilterView
                    patientIds={subjectIds}
                    filterRange={filterRange}
                    filterPatients={this.filterPatients}
                    onClose={this.onClose}
                    contribution={distribution}
                    patientInfoMeta={patientInfoMeta}
                    visible={visible}
                  />
               </p>
             </Drawer>
            } 

          </Content>
        </Layout>
      </div>
    )
  }
}

export default App;

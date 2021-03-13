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
    console.log('init', subjectIdG)
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
        this.setState({subjectIdG, conditions})
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
    const idGs: number [] = subjectIdG && subjectIdG.subject_idG.slice(0, 100)
    const predictionG: string[] = subjectIdG && subjectIdG.predictionG.slice(0, 100)  
    const similarityG:number [] = subjectIdG && subjectIdG.similarity && subjectIdG.similarity.slice(0, 100)
    console.log('predictionG', predictionG)
    const complicationtypes = ['lung complication','cardiac complication','arrhythmia complication','infectious complication','other complication']
    const brieftcomplitype = ['L', 'C', 'A', 'I', 'O']
    const series:number [] = subjectIdG && subjectIdG.distribution
    console.log('app', series)

     const option={
                tooltip:{trigger: 'axis'},
                xAxis: {data: ['No complication','lung complication','cardiac complication','arrhythmia complication','infectious complication','other complication']},
                yAxis: {type: 'value'},
                series : [{ name:'Patient Numer', type:'bar',barWidth: '50%',data: series, itemStyle: { color: 'blue'} }]
                }
    // const series:number [] = subjectIdG && [subjectIdG.lung_num, subjectIdG.cardiac_num, subjectIdG.arrhythmia_num, subjectIdG.infectious_num, subjectIdG.other_num]
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
            <span className="patient-selector-title" style={{marginLeft:'20px'}}>Compared PatientId: </span>
            <Select style={{ width: 200 }} onChange={this.selectComparePatientId} className="compare-patient-selector">
              {/*series && series.length? 
                  <div className='echart'>
                     <ReactEcharts option={option}/>
                   </div>
               :''*/}
              {idGs && idGs.map((id, i) =>
                <>
                  <Option value={id} key={i} >
                    <Row style={{width:'100%'}}>
                      <Col span={4}> {id}</Col>
                      <Col span={2}/> 
                      <Col span={14}>
                        <Avatar.Group size={27}>
                         { predictionG && predictionG[i].split('-').map((complicationtype,idx) => 
                            complicationtype=='1'? <Avatar style={{ backgroundColor: '#eaf0f9', color:'black' }}> {brieftcomplitype[idx]} </Avatar> :''
                          )}
                        </Avatar.Group>
                      </Col>
                     <Col span={2}> {similarityG?similarityG[i]:0} </Col>
                     <Col span={2}/>
                    </Row>
                  </Option>

                 </>
              )}
            </Select>
            <Tooltip title="Filter">
              <Button type="primary" shape="circle" icon={<FilterOutlined />} onClick={this.showDrawer} style={{marginLeft:'20px', zIndex:1}}/>
            </Tooltip>
            <span className="patient-selector-title" style={{marginLeft:'20px'}}> Filtred Result: {subjectIdG && subjectIdG.subject_idG? subjectIdG.subject_idG.length:0} </span>

           {/*series && series.length?
             <div className='echart' style={{float:'right', width: '100px', height:'30px', background:'white'}}>
               <ReactEcharts option={option}/>
             </div>
             :''*/}
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
                    contribution={series}
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

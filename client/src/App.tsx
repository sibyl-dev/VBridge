import React from 'react';
import * as d3 from "d3"

import { Layout, Drawer, Tooltip, Button, Select, Avatar, Divider, Row, Col } from 'antd'
import { FilterOutlined } from '@ant-design/icons'
import './App.css';

import FeatureView from "./components/FeatureView"
import MetaView from "./components/MetaView"
import TableView from "./components/TableView"
import TimelineView from "./components/TimelineView"

import DynamicView, { SignalMeta } from "./components/DynamicView"
import FilterView from "./components/FilterView"

import { getFeatureMate, getPatientIds, getPatientMeta, getPatientInfoMeta, getPatientRecords, getPredictionTargets, getTableNames, getPatientFilterRange, getPatientGroup, getItemDict } from "./router/api"
import { PatientMeta } from 'data/patient';
import { Entity, ItemDict } from 'data/table';
import { patientInfoMeta } from 'data/metaInfo';
import { filterType } from 'data/filterType';

import Panel from 'components/Panel';
import { Feature, FeatureMeta } from 'data/feature';
import { DataFrame, IDataFrame } from 'data-forge';
import _, { isUndefined } from 'lodash';
import { distinct, isDefined } from 'data/common';

import Histogram from "visualization/Histogram";
import {getScaleLinear, defaultCategoricalColor} from "visualization/common";


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
  signalMeta: SignalMeta[],
  pinnedSignalMeta: SignalMeta[],
  focusedFeatures: string[],
  pinnedfocusedFeatures: string[],

  patientInfoMeta?: { [key: string]: any },
  filterRange?: filterType,
  subjectIdG?: { [key: string]: any },
  selectedsubjectId?: number,
  conditions?: { [key: string]: any },
  visible?: boolean,
}

class App extends React.Component<AppProps, AppStates>{
  private layout = { featureViewWidth: 500, timelineViewWidth: 800, ProfileWidth: 300, timelineViewHeight: 260, headerHeight: 64 };
  private abnormalityColorScale = d3.scaleSequential(d3.interpolateRdYlGn).domain([2.5 + 0.5, 1 - 0.5]);

  constructor(props: AppProps) {
    super(props);
    this.state = {
      signalMeta: [], pinnedSignalMeta: [], conditions: { '': '' },
      focusedFeatures: [], pinnedfocusedFeatures: []
    };

    this.selectPatientId = this.selectPatientId.bind(this);
    this.selectComparePatientId = this.selectComparePatientId.bind(this)
    this.loadPatientRecords = this.loadPatientRecords.bind(this);
    this.filterPatients = this.filterPatients.bind(this)
    this.buildRecordTS = this.buildRecordTS.bind(this);
    this.updateRecordTS = this.updateRecordTS.bind(this);
    this.showDrawer = this.showDrawer.bind(this)
    this.onClose = this.onClose.bind(this)

    // Call-backs to update the Temporal View
    this.updateSignals = this.updateSignals.bind(this);
    this.buildSignalsByFeature = this.buildSignalsByFeature.bind(this);
    this.updateSignalsByFeature = this.updateSignalsByFeature.bind(this);
    this.pinSignal = this.pinSignal.bind(this);
    this.removeSignal = this.removeSignal.bind(this);

    // Call-backs to update the Feature View
    this.updateFocusedFeatures = this.updateFocusedFeatures.bind(this);
    this.updatePinnedFocusedFeatures = this.updatePinnedFocusedFeatures.bind(this);

    this.entityCategoricalColor = this.entityCategoricalColor.bind(this);
    this.abnormalityColor = this.abnormalityColor.bind(this);
  }

  componentDidMount() {
    this.init();
  }

  componentDidUpdate(prevProps: AppProps, prevState: AppStates) {
    if (prevState.patientMeta?.subjectId !== this.state.patientMeta?.subjectId) {
      const { featureMeta } = this.state;
      // if (featureMeta) {
      //   const signalMetaDF = featureMeta.select(row => this.buildRecordTSFromFeature(row));
      //   const signalMetaGroups = signalMetaDF.groupBy(row => `${row?.tableName}.${row?.itemName}`);
      //   const signalMeta: SignalMeta[] = signalMetaGroups.select(group => {
      //     const sample = group.first();
      //     if (sample)
      //       return {
      //         ...sample,
      //         relatedFeatureNames: group.getSeries('relatedFeatureNames').toArray() as string[]
      //       }
      //     else
      //       return undefined
      //   }).toArray().filter(isDefined);
      //   this.setState({ signalMeta });
      // }
    }
  }

  public async init() {
    const subjectIds = await getPatientIds();
    const tableNames = await getTableNames();
    const filterRange = await getPatientFilterRange();
    const itemDicts = await getItemDict();

    const featureMeta = new DataFrame(await getFeatureMate());
    const predictionTargets = await getPredictionTargets();

    const subjectIdG = (await getPatientGroup({ filterConditions: { 'aha': '' }, subject_id: 0, setSubjectIdG:true }))
    // const prediction = (await getPatientGroup({ filterConditions: filterConditions })).prediction
    console.log('init', subjectIdG, filterRange)
    this.setState({ subjectIds, tableNames, filterRange, featureMeta, predictionTargets, itemDicts, subjectIdG});

  }

  public async selectPatientId(subjectId: number) {
    const selectedsubjectId = subjectId
    const patientMeta = await getPatientMeta({ subject_id: subjectId });
    const patientInfoMeta = await getPatientInfoMeta({ subject_id: subjectId });
    const tableRecords = await this.loadPatientRecords(subjectId);
    if (this.state.conditions) {
      const subjectIdG = (await getPatientGroup({ filterConditions: this.state.conditions, subject_id: subjectId, setSubjectIdG: true }))
      this.setState({subjectIdG})
    }
    this.setState({ patientMeta, tableRecords, patientInfoMeta, selectedsubjectId });
  }
  public async selectComparePatientId(subjectId: number) {

  }

  private async filterPatients(conditions: {[key: string]: any}, changeornot:boolean) {
    if(changeornot){
        const subjectIdG = (await getPatientGroup({filterConditions: conditions, subject_id: 0, setSubjectIdG: true}))
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

  private buildSignalsByFeature(feature: Feature): SignalMeta[] {
    const { patientMeta } = this.state;
    let signalMetaList: SignalMeta[] = [];
    if (feature.children && feature.children.count() > 0) {
      for (const child of feature.children) {
        signalMetaList = signalMetaList.concat(this.buildSignalsByFeature(child))
      }
    }
    else {
      const { entityId, whereItem, columnName, name, period } = feature;
      const entity = this.state.tableRecords?.find(e => e.name === entityId);
      if (entity && entity.metaInfo && patientMeta) {
        const { item_index, time_index } = entity.metaInfo;
        const { SurgeryBeginTime, SurgeryEndTime } = patientMeta;
        const startTime = (period === 'in-surgery') ? SurgeryBeginTime :
          new Date(SurgeryBeginTime.getTime() - 1000 * 60 * 60 * 24 * 2);
        const endTime = (period === 'in-surgery') ? SurgeryEndTime : SurgeryBeginTime;
        if (item_index && time_index && entityId)
          signalMetaList.push({
            tableName: entityId,
            columnName: columnName,
            itemName: whereItem[1] as string,
            relatedFeatureNames: [name],
            startTime: startTime,
            endTime: endTime,
            featurePeriods: () => [startTime, endTime],
          })
      }
    }
    return signalMetaList
  }

  private updateSignalsByFeature(feature: Feature) {
    const newSignals = this.buildSignalsByFeature(feature);
    this.updateSignals(newSignals);
  }

  private updateSignals(newSignalMeta: SignalMeta[]) {
    const rawSignalMeta = new DataFrame([...this.state.pinnedSignalMeta, ...newSignalMeta]);
    // const rawSignalMeta = new DataFrame([...newSignalMeta]);
    const signalMeta: SignalMeta[] = rawSignalMeta.groupBy(row => row.itemName).toArray().map(group => {
      const sample = group.first();
      return {
        ...sample,
        relatedFeatureNames: _.flatten(group.getSeries('relatedFeatureNames').toArray()),
        startTime: _.min(group.getSeries('startTime').toArray()),
        endTime: _.max(group.getSeries('endTime').toArray())
      }
    })
    this.setState({ signalMeta });
  }

  private pinSignal(signalMeta: SignalMeta) {
    const { pinnedSignalMeta } = this.state;
    const pinnedSignalNames = pinnedSignalMeta.map(s => `${s.itemName}`);
    if (pinnedSignalNames.includes(signalMeta.itemName)) {
      this.setState({ pinnedSignalMeta: pinnedSignalMeta.filter(s => s.itemName !== signalMeta.itemName) });
    }
    else {
      pinnedSignalMeta.push(signalMeta);
      this.setState({ pinnedSignalMeta });
    }
  }

  private removeSignal(targetSignal: SignalMeta) {
    const { pinnedSignalMeta, signalMeta } = this.state;
    this.setState({ pinnedSignalMeta: pinnedSignalMeta.filter(s => s.itemName !== targetSignal.itemName),
        signalMeta: signalMeta.filter(s => s.itemName !== targetSignal.itemName),
     });
  }

  private buildRecordTS(entityName: string, startDate: Date, endDate: Date): SignalMeta[] {
    const entity = this.state.tableRecords?.find(e => e.name === entityName);
    const { item_index, time_index, value_indexes } = entity?.metaInfo!;
    if (entity && item_index && time_index && value_indexes && value_indexes.length > 0) {
      const selectedDf = entity.where(row => startDate < new Date(row[time_index]) && new Date(row[time_index]) < endDate)
        .groupBy(row => (row[item_index]));
      let records: SignalMeta[] = [];
      for (const itemDf of selectedDf) {
        const itemRecords: SignalMeta[] = value_indexes.map(value_index => {
          return {
            tableName: entity.name!,
            columnName: value_index,
            itemName: itemDf.first()[item_index],
            startTime: startDate,
            endTime: endDate,
            // TODO: check this
            relatedFeatureNames: []
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
    this.setState({ signalMeta: newRecords });
  }

  private updateFocusedFeatures(featureNames: string[]) {
    this.setState({ focusedFeatures: featureNames })
  }

  private updatePinnedFocusedFeatures(featureNames: string[]) {
    const { pinnedfocusedFeatures } = this.state;
    let newfeatures = [...pinnedfocusedFeatures];
    for (const featureName of featureNames.filter(distinct)) {
      if (pinnedfocusedFeatures.includes(featureName)) {
        newfeatures = newfeatures.filter(f => f !== featureName);
      }
      else {
        newfeatures.push(featureName);
      }
    }
    this.setState({ pinnedfocusedFeatures: newfeatures });
  }

  private showDrawer = () => {
    const visible = true
    this.setState({ visible })
  };
  private onClose = () => {
    const visible = false
    this.setState({ visible })
    // console.log('onClose', this.state.filterConditions)
  };

  private entityCategoricalColor(entityName?: string) {
    const { tableNames } = this.state;
    let i = 0;
    if (tableNames && entityName)
      i = tableNames?.indexOf(entityName) + 1;
    return defaultCategoricalColor(i);
  }

  private abnormalityColor(abnormality: number) {
    return this.abnormalityColorScale(Math.max(Math.min(abnormality, 2.5), 1));
  }

  public render() {

    const { subjectIds, patientMeta, tableNames, tableRecords, featureMeta, predictionTargets,
      focusedFeatures, pinnedfocusedFeatures,
      itemDicts, signalMeta: dynamicRecords, patientInfoMeta, filterRange, visible, subjectIdG , selectedsubjectId} = this.state
    const layout = this.layout;
    
    const distribution = subjectIdG && subjectIdG.distribution
    const complicationtypes = ['Lung Comp.','Cardiac Comp.','Arrhythmia Comp.','Infectious Comp.','Other Comp.', 'No Comp.']
    const brieftcomplitype = ['L', 'C', 'A', 'I', 'O', 'No']
    // const distribution:number [] = subjectIdG && subjectIdG.distribution
    let complicationRes:number[] = [0,0,0,0,0]
    if(patientInfoMeta)
      complicationRes = [patientInfoMeta['lung complication'], patientInfoMeta['cardiac complication'],patientInfoMeta['arrhythmia complication'],patientInfoMeta['infectious complication'],patientInfoMeta['other complication']]
    if(distribution)
      var x = getScaleLinear(0, 80, distribution);
    const avatatColor = (id: number) => {
            if (id == 0)
                return '#cccccc'
            else 
                return '#7fa5ec'
    }
    return (
      <div className='App'>
        <Layout>
          <Header className="app-header">
            <Row>
              <Col span={2} className='system-name'>Bridges</Col>
              <Col span={4} />
              <Col span={2} className='header-name'> PatientId: </Col>
              <Col span={4} className='header-content'>
                <Select style={{ width: 120, marginRight:'20px' }} onChange={this.selectPatientId} className="patient-selector">
                  {subjectIds && subjectIds.map((id, i) =>
                    <Option value={id} key={i}>{id}</Option>
                  )}
                </Select>
              </Col>
              <Col span={1} />
              <Col span={3} className='header-name'> #Comparative Group: </Col>
              <Col span={2} className='header-content'>
                  <Tooltip title="Filter">
                    <Button type="primary" shape="circle" icon={<FilterOutlined />} onClick={this.showDrawer} style={{zIndex: 1 }} />
                  </Tooltip>
                  <span className="header-name"> {subjectIdG && subjectIdG.subject_idG? subjectIdG.subject_idG.length:0} </span>
              </Col>
              <Col span={6}/>
            </Row>
            <Row>
              <Col span={6} />
              <Col span={2} className='header-name'>Predictions: </Col>
              <Col span={4} className='header-content'>
                  {brieftcomplitype&& complicationRes && brieftcomplitype.map((name,i) =>
                   i<5?  
                   <Tooltip title={complicationtypes[i]} placement="top">
                     <Avatar style={{backgroundColor: avatatColor(complicationRes[i])}}>{name}</Avatar>
                   </Tooltip>:''
                 )}
              </Col>
              <Col span={1}/>
              <Col span={3} className='header-name'> #Healthy Group: </Col>
              <Col span={2} className='header-content'>
                {distribution?distribution[5]:0} 
              </Col>
              <Col span={6}/>
            </Row>
          </Header>
          <Content>
            <Panel initialWidth={layout.featureViewWidth}
              initialHeight={window.innerHeight - layout.headerHeight} x={0} y={0} title="Feature View">
              {featureMeta && predictionTargets && tableNames && <FeatureView
                patientMeta={patientMeta}
                featureMeta={featureMeta}
                predictionTargets={predictionTargets}
                tableNames={tableNames}
                subjectIdG={subjectIdG && subjectIdG.subject_idG}
                itemDicts={itemDicts}
                entityCategoricalColor={this.entityCategoricalColor}
                abnormalityColor={this.abnormalityColor}
                focusedFeatures={[...pinnedfocusedFeatures, ...focusedFeatures]}
                inspectFeature={this.updateSignalsByFeature}
              />}
            </Panel>
            <Panel initialWidth={layout.timelineViewWidth} initialHeight={layout.timelineViewHeight}
              x={layout.featureViewWidth + 5} y={0} title="Timeline View">
              {featureMeta && <TimelineView
                patientMeta={patientMeta}
                featureMeta={featureMeta}
                tableRecords={tableRecords}
                onSelectEvents={this.updateRecordTS}
                entityCategoricalColor={this.entityCategoricalColor}
              />}
            </Panel>

            <Panel initialWidth={layout.timelineViewWidth}
              initialHeight={window.innerHeight - layout.headerHeight - layout.timelineViewHeight - 5}
              x={layout.featureViewWidth + 5} y={265} title="Signal View">
              {patientMeta && featureMeta && tableRecords && <DynamicView
                patientMeta={patientMeta}
                featureMeta={featureMeta}
                tableRecords={tableRecords}
                signalMetas={dynamicRecords}
                itemDicts={itemDicts}
                color={this.entityCategoricalColor}
                updateFocusedFeatures={this.updateFocusedFeatures}
                updatePinnedFocusedFeatures={this.updatePinnedFocusedFeatures}
                pinSignal={this.pinSignal}
                removeSignal={this.removeSignal}
              />}
            </Panel>
            <Panel initialWidth={layout.ProfileWidth} initialHeight={window.innerHeight - layout.headerHeight}
              x={layout.featureViewWidth + layout.timelineViewWidth + 10} y={0} title="Patient View">
              {tableNames && featureMeta && <MetaView
                patientIds={subjectIds}
                featureMeta={featureMeta}
                patientInfoMeta={patientInfoMeta}
                updateFocusedFeatures={this.updateFocusedFeatures}
                updatePinnedFocusedFeatures={this.updatePinnedFocusedFeatures}
              />
              }
            </Panel>

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
                    selectedsubjectId={selectedsubjectId}
                    filterRange={filterRange}
                    filterPatients={this.filterPatients}
                    onClose={this.onClose}
                    patientInfoMeta={patientInfoMeta}
                    visible={visible}
                    subjectIdG={subjectIdG && subjectIdG.subject_idG}
                    distributionApp={distribution}
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

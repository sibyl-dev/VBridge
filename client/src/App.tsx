import React from 'react';
import * as d3 from "d3"

import { Layout, Drawer, Tooltip, Button, Select, Avatar, Divider, Row, Col, Switch } from 'antd'
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

import { defaultCategoricalColor, getChildOrAppend, getOffsetById } from 'visualization/common';


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
  signalMetas: SignalMeta[],
  pinnedSignalMetas: SignalMeta[],
  focusedFeatures: string[],
  pinnedfocusedFeatures: string[],

  //for view settings
  featureViewDense: boolean,
  dynamicViewLink: boolean,
  dynamicViewAlign: boolean,

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
  private ref: React.RefObject<SVGSVGElement> = React.createRef();
  private paintId: any = undefined;

  constructor(props: AppProps) {
    super(props);
    this.state = {
      signalMetas: [], pinnedSignalMetas: [], conditions: { '': '' },
      focusedFeatures: [], pinnedfocusedFeatures: [],
      featureViewDense: false, dynamicViewLink: false, dynamicViewAlign: false
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

    this.paintLink = this.paintLink.bind(this);
    this.removeLink = this.removeLink.bind(this);
  }

  componentDidMount() {
    this.init();
    // this.paint();
    // this.paintId = setInterval(this.paintLink, 200);
  }

  componentWillUnmount() {
    window.clearInterval(this.paintId);
  }

  componentDidUpdate(prevProps: AppProps, prevState: AppStates) {
    const {patientMeta, dynamicViewLink} = this.state;
    if (prevState.patientMeta?.subjectId !== patientMeta?.subjectId) {
    }
    if (prevState.dynamicViewLink !== dynamicViewLink) {
      if (dynamicViewLink) {
        this.paintId = setInterval(this.paintLink, 200);
      }
      else {
        window.clearInterval(this.paintId);
        this.removeLink();
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

    const subjectIdG = (await getPatientGroup({ filterConditions: { '': '' }, subject_id: 0 }))
    // const prediction = (await getPatientGroup({ filterConditions: filterConditions })).prediction
    console.log('init', subjectIdG)
    this.setState({ subjectIds, tableNames, filterRange, featureMeta, predictionTargets, itemDicts, subjectIdG });
  }

  public async selectPatientId(subjectId: number) {
    const selectedsubjectId = subjectId
    const patientMeta = await getPatientMeta({ subject_id: subjectId });
    const patientInfoMeta = await getPatientInfoMeta({ subject_id: subjectId });
    const tableRecords = await this.loadPatientRecords(subjectId);
    if (this.state.conditions) {
      const subjectIdG = (await getPatientGroup({ filterConditions: this.state.conditions, subject_id: subjectId }))
      this.setState({ subjectIdG })
    }
    this.setState({ patientMeta, tableRecords, patientInfoMeta, selectedsubjectId });
  }
  public async selectComparePatientId(subjectId: number) {

  }

  private async filterPatients(conditions: { [key: string]: any }, changeornot: boolean) {
    if (changeornot && this.state.selectedsubjectId) {
      const subjectIdG = (await getPatientGroup({ filterConditions: conditions, subject_id: this.state.selectedsubjectId }))
      this.setState({ subjectIdG, conditions })
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
            relatedFeatureNames: name ? [name] : [],
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
    const rawSignalMeta = new DataFrame([...this.state.pinnedSignalMetas, ...newSignalMeta]);
    // const rawSignalMeta = new DataFrame([...newSignalMeta]);
    const signalMetas: SignalMeta[] = rawSignalMeta.groupBy(row => row.itemName).toArray().map(group => {
      const sample = group.first();
      return {
        ...sample,
        relatedFeatureNames: _.flatten(group.getSeries('relatedFeatureNames').toArray()),
        startTime: _.min(group.getSeries('startTime').toArray()),
        endTime: _.max(group.getSeries('endTime').toArray())
      }
    })
    this.setState({ signalMetas });
  }

  private pinSignal(signalMeta: SignalMeta) {
    const { pinnedSignalMetas } = this.state;
    const pinnedSignalNames = pinnedSignalMetas.map(s => `${s.itemName}`);
    if (pinnedSignalNames.includes(signalMeta.itemName)) {
      this.setState({ pinnedSignalMetas: pinnedSignalMetas.filter(s => s.itemName !== signalMeta.itemName) });
    }
    else {
      pinnedSignalMetas.push(signalMeta);
      this.setState({ pinnedSignalMetas: pinnedSignalMetas });
    }
  }

  private removeSignal(targetSignal: SignalMeta) {
    const { pinnedSignalMetas, signalMetas } = this.state;
    this.setState({
      pinnedSignalMetas: pinnedSignalMetas.filter(s => s.itemName !== targetSignal.itemName),
      signalMetas: signalMetas.filter(s => s.itemName !== targetSignal.itemName),
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
    this.setState({ signalMetas: newRecords });
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

  private paintLink() {
    const { signalMetas } = this.state;

    const headerHeight = document.getElementById('header')?.offsetHeight || 0;
    const positions = signalMetas.map(signal => {
      const end = getOffsetById(`temporal-view-element-${signal.itemName}`);
      if (end)
        return signal.relatedFeatureNames.map(featureName => {
          const start = getOffsetById(`feature-view-element-${featureName}`);
          if (start)
            return {
              x1: start.right,
              y1: (start.top + start.bottom) / 2,
              x2: end.left,
              y2: (end.top + end.bottom) / 2,
              path: d3.line()([
                [start.right, start.top],
                [end.left, end.top],
                [end.left, end.bottom],
                [start.right, start.bottom],
              ]),
              color: this.entityCategoricalColor(signal.tableName)
            }
        }).filter(isDefined);
    }).filter(isDefined);

    const node = this.ref.current;
    if (node) {
      const root = d3.select(node);
      const base = getChildOrAppend(root, 'g', 'link-base')
        .attr("transform", `translate(0, ${-headerHeight})`);
      const linkGroups = base.selectAll(".between-view-link-g")
        .data(positions)
        .join(
          enter => enter.append("g")
            .attr("class", "between-view-link-g"),
          update => update,
          exit => exit.remove()
        );
      linkGroups.selectAll(".between-view-link")
        .data(d => d)
        .join(
          enter => enter.append("path")
            .attr("class", "between-view-link"),
          update => update,
          exit => exit.remove()
        )
        .attr('d', d => d.path)
        .style('fill', d => d.color);
        // .attr("x1", d => d.x1)
        // .attr("x2", d => d.x2)
        // .attr("y1", d => d.y1)
        // .attr("y2", d => d.y2);
    }
  }

  private removeLink() {
    const node = this.ref.current;
    if (node) {
      const root = d3.select(node);
      getChildOrAppend(root, 'g', 'link-base').remove();
    }
  }

  public render() {

    const { subjectIds, patientMeta, tableNames, tableRecords, featureMeta, predictionTargets,
      focusedFeatures, pinnedfocusedFeatures,
      itemDicts, signalMetas: dynamicRecords, patientInfoMeta, filterRange, visible, subjectIdG } = this.state;
    const layout = this.layout;
    const idGs: number[] = subjectIdG && subjectIdG.subject_idG.slice(0, 100)
    const predictionG: string[] = subjectIdG && subjectIdG.predictionG.slice(0, 100)
    const similarityG: number[] = subjectIdG && subjectIdG.similarity && subjectIdG.similarity.slice(0, 100)
    const complicationtypes = ['lung complication', 'cardiac complication', 'arrhythmia complication', 'infectious complication', 'other complication']
    const brieftcomplitype = ['L', 'C', 'A', 'I', 'O']
    const series: number[] = subjectIdG && subjectIdG.distribution

    const option = {
      tooltip: { trigger: 'axis' },
      xAxis: { data: ['No complication', 'lung complication', 'cardiac complication', 'arrhythmia complication', 'infectious complication', 'other complication'] },
      yAxis: { type: 'value' },
      series: [{ name: 'Patient Numer', type: 'bar', barWidth: '50%', data: series, itemStyle: { color: 'blue' } }]
    }
    // const series:number [] = subjectIdG && [subjectIdG.lung_num, subjectIdG.cardiac_num, subjectIdG.arrhythmia_num, subjectIdG.infectious_num, subjectIdG.other_num]
    return (
      <div className='App'>
        <Layout>
          <Header className="app-header" id="header">
            <p className='system-name'>Bridges</p>
            <span className="patient-selector-title">PatientId: </span>
            <Select style={{ width: 120 }} onChange={this.selectPatientId} className="patient-selector">
              {subjectIds && subjectIds.map((id, i) =>
                <Option value={id} key={i}>{id}</Option>
              )}
            </Select>
            <span className="patient-selector-title" style={{ marginLeft: '20px' }}>Compared PatientId: </span>
            <Select style={{ width: 200 }} onChange={this.selectComparePatientId} className="compare-patient-selector">
              {/* {idGs && idGs.map((id, i) =>
                  <Option value={id} key={i} >
                    <Row style={{ width: '100%' }}>
                      <Col span={4}> {id}</Col>
                      <Col span={2} />
                      <Col span={14}>
                        <Avatar.Group size={27}>
                          {predictionG && predictionG[i].split('-').map((complicationtype, idx) =>
                            complicationtype == '1' ? <Avatar style={{ backgroundColor: '#eaf0f9', color: 'black' }}> {brieftcomplitype[idx]} </Avatar> : ''
                          )}
                        </Avatar.Group>
                      </Col>
                      <Col span={2}> {similarityG ? similarityG[i] : 0} </Col>
                      <Col span={2} />
                    </Row>
                  </Option>
              )} */}
            </Select>
            <Tooltip title="Filter">
              <Button type="primary" shape="circle" icon={<FilterOutlined />} onClick={this.showDrawer} style={{ marginLeft: '20px', zIndex: 1 }} />
            </Tooltip>
            <span className="patient-selector-title" style={{ marginLeft: '20px' }}> Filtred Result: {subjectIdG && subjectIdG.subject_idG ? subjectIdG.subject_idG.length : 0} </span>

            {/*series && series.length?
             <div className='echart' style={{float:'right', width: '100px', height:'30px', background:'white'}}>
               <ReactEcharts option={option}/>
             </div>
             :''*/}
          </Header>
          <Content>
            <Panel initialWidth={layout.featureViewWidth}
              initialHeight={window.innerHeight - layout.headerHeight} x={0} y={0}
              title={<div className="view-title">
                <span className="view-title-text">Feature View</span>
                <Switch onChange={e => this.setState({ featureViewDense: e })} style={{ float: 'right' }}
                  checkedChildren="focus" />
              </div>}>
              {featureMeta && predictionTargets && tableNames && <FeatureView
                className={"feature-view-element"}
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
                display={this.state.featureViewDense ? 'dense' : 'normal'}
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
              x={layout.featureViewWidth + 5} y={265} title={
                <div className="view-title">
                  <span className="view-title-text">Temporal View</span>
                  <Switch onChange={e => this.setState({dynamicViewLink: e})}/>
                  <Switch onChange={e => this.setState({dynamicViewAlign: e})} checkedChildren="align" />
                </div>
              }>
              {patientMeta && featureMeta && tableRecords && <DynamicView
                className={"temporal-view-element"}
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
                className={"meta-view-element"}
                patientIds={subjectIds}
                featureMeta={featureMeta}
                patientInfoMeta={patientInfoMeta}
                updateFocusedFeatures={this.updateFocusedFeatures}
                updatePinnedFocusedFeatures={this.updatePinnedFocusedFeatures}
              />
              }
            </Panel>
            <svg className="app-link-svg" ref={this.ref} />
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

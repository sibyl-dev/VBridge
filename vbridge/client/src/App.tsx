import React from 'react';
import * as d3 from "d3"
import * as _ from 'lodash';

import { Layout, Drawer, Tooltip, Button, Select, Switch } from 'antd'
import { FilterOutlined } from '@ant-design/icons'

import FeatureView from "./components/FeatureView"
import MetaView from "./components/MetaView"
import TableView, { TableMeta } from "./components/TableView"
import TimelineView from "./components/TimelineView"

import DynamicView, { SignalMeta } from "./components/DynamicView"
import FilterView from "./components/FilterView"

import {
  getFeatureMate, getPatientIds, getPatientMeta, getPatientRecords,
  getPredictionTargets, getTableNames, getPatientFilterRange, getPatientGroup, getItemDict, getPrediction, getReferenceValues
} from "./router/api"
import { PatientGroup, PatientMeta } from 'data/patient';
import { Entity, ItemDict } from 'data/table';
import { filterType } from 'data/filterType';

import Panel from 'components/Panel';
import { Feature, FeatureMeta } from 'data/feature';
import { DataFrame, IDataFrame } from 'data-forge';
import { distinct, isDefined, ReferenceValueDict } from 'data/common';

import { defaultCategoricalColor, getChildOrAppend, getOffsetById } from 'visualization/common';
import { CloseOutlined } from '@material-ui/icons';

import './App.css';

const { Header, Content } = Layout;
const { Option } = Select;

interface AppProps { }

interface AppStates {
  // static information
  subjectIds?: number[],
  tableNames?: string[],
  featureMeta?: IDataFrame<number, FeatureMeta>,
  predictionTargets?: string[],
  itemDicts?: ItemDict,
  target?: string,

  //patient information
  tableRecords?: Entity<number, any>[],
  patientMeta?: PatientMeta,
  predictions?: (target: string) => number,

  //for table view
  tableViewMeta?: TableMeta,
  showTableView: boolean,

  //for view communication
  signalMetas: SignalMeta[],
  pinnedSignalMetas: SignalMeta[],
  focusedFeatures: string[],
  pinnedfocusedFeatures: string[],

  //for view settings
  featureViewDense: boolean,
  dynamicViewLink: boolean,
  dynamicViewAlign: boolean,

  // for patient group & reference values
  filterRange?: filterType,
  patientGroup?: PatientGroup,
  conditions?: { [key: string]: any },
  referenceValues?: (tableName: string) => ReferenceValueDict | undefined,

  // others
  visible?: boolean,
}

class App extends React.Component<AppProps, AppStates>{
  private layout = { featureViewWidth: 520, ProfileWidth: 280, timelineViewHeight: 220, headerHeight: 64, xPadding: 15, yPadding: 5 };
  private abnormalityColorScale = d3.scaleSequential(d3.interpolateRdYlGn).domain([2.5 + 0.5, 1 - 0.5]);
  private ref: React.RefObject<SVGSVGElement> = React.createRef();
  private paintId: any = undefined;

  constructor(props: AppProps) {
    super(props);
    this.state = {
      signalMetas: [], pinnedSignalMetas: [], conditions: { '': '' },
      focusedFeatures: [], pinnedfocusedFeatures: [], showTableView: false,
      featureViewDense: false, dynamicViewLink: false, dynamicViewAlign: false
    };

    this.selectPatientId = this.selectPatientId.bind(this);
    this.loadPatientRecords = this.loadPatientRecords.bind(this);
    this.loadPredictions = this.loadPredictions.bind(this);
    this.loadReferenceValues = this.loadReferenceValues.bind(this);
    this.filterPatients = this.filterPatients.bind(this)
    this.buildRecordByPeriod = this.buildRecordByPeriod.bind(this);
    this.updateSignalFromTimeline = this.updateSignalFromTimeline.bind(this);
    this.showDrawer = this.showDrawer.bind(this);

    // Call-backs to update the Temporal View
    this.updateSignals = this.updateSignals.bind(this);
    this.buildSignalsByFeature = this.buildSignalsByFeature.bind(this);
    this.updateSignalsByFeature = this.updateSignalsByFeature.bind(this);
    this.pinSignal = this.pinSignal.bind(this);
    this.removeSignal = this.removeSignal.bind(this);

    this.updateTableView = this.updateTableView.bind(this);
    this.updateTableViewFromFeatures = this.updateTableViewFromFeatures.bind(this);

    // Call-backs to update the Feature View
    this.updateFocusedFeatures = this.updateFocusedFeatures.bind(this);
    this.updatePinnedFocusedFeatures = this.updatePinnedFocusedFeatures.bind(this);

    this.entityCategoricalColor = this.entityCategoricalColor.bind(this);
    this.abnormalityColor = this.abnormalityColor.bind(this);

    this.paintLink = this.paintLink.bind(this);
    this.removeLink = this.removeLink.bind(this);

    this.tableNamesChange = this.tableNamesChange.bind(this)
  }

  componentDidMount() {
    this.init();
  }

  componentWillUnmount() {
    window.clearInterval(this.paintId);
  }

  componentDidUpdate(prevProps: AppProps, prevState: AppStates) {
    const { patientMeta, dynamicViewLink, tableNames, patientGroup } = this.state;
    if (prevState.patientMeta?.subjectId !== patientMeta?.subjectId) {
      this.loadPredictions();
      this.setState({ pinnedSignalMetas: [] });
    }
    if (prevState.dynamicViewLink !== dynamicViewLink) {
      if (dynamicViewLink) {
        this.paintId = setInterval(this.paintLink);
      }
      else {
        window.clearInterval(this.paintId);
        this.removeLink();
      }
    }
    if (prevState.tableNames !== tableNames || prevState.patientGroup != patientGroup) {
      this.loadReferenceValues()
    }
  }

  public async init() {
    const subjectIds = await getPatientIds();
    const tableNames = await getTableNames();
    const filterRange = await getPatientFilterRange();
    const itemDicts = await getItemDict();

    const featureMeta = new DataFrame(await getFeatureMate());
    const predictionTargets = await getPredictionTargets();

    const patientGroup = await getPatientGroup({ filters: { 'aha': '' }});
    this.setState({ subjectIds, tableNames, filterRange, featureMeta, predictionTargets, itemDicts, patientGroup });
  }

  private async loadPredictions() {
    const { patientMeta } = this.state;
    console.log("load predictions");
    if (patientMeta) {
      const predictions = await getPrediction({ subject_id: patientMeta?.subjectId });
      this.setState({ predictions });
    }
  }

  private async loadReferenceValues() {
    const { tableNames } = this.state;
    if (tableNames) {
      const references: { name: string, referenceValues: ReferenceValueDict }[] = [];
      for (const name of tableNames) {
        let targetColumn = undefined;
        if (name === 'CHARTEVENTS') {
          targetColumn = 'VALUE';
        }
        if (name === 'SURGERY_VITAL_SIGNS') {
          targetColumn = 'VALUE';
        }
        if (name === 'LABEVENTS') {
          targetColumn = 'VALUENUM';
        }
        if (targetColumn) {
          const referenceValues = await getReferenceValues({ table_name: name, column_name: targetColumn });
          references.push({ name, referenceValues });
        }
      }
      this.setState({ referenceValues: (tableName: string) => references.find(e => e.name === tableName)?.referenceValues })
    }
  }

  public async selectPatientId(subjectId: number) {
    // subjectId=11300
    const patientMeta = await getPatientMeta({ subject_id: subjectId });
    const tableRecords = await this.loadPatientRecords(subjectId);
    if (patientMeta) {
      const subjectIdG = await getPatientGroup({ filters: { '': ''}})
      this.setState({ patientGroup: subjectIdG })
    }
    const selected = 'lung complication'
    this.setState({ patientMeta, tableRecords, target: selected });
  }
  public judgeTheAge(days: number) {
    if (days <= 28) return '< 1 month'
    else if (days <= 12 * 30) return '< 1 year'
    else if (days <= 36 * 30) return '1-3 years'
    else return '> 3 years'
  }

  private async filterPatients(conditions: { [key: string]: any }, changeornot: boolean) {
    if (changeornot) {
      const subjectIdG = await getPatientGroup({ filters: conditions});
      this.setState({ patientGroup: subjectIdG, conditions: Object.assign({}, conditions) })
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
        const { SURGERY_BEGIN_TIME: SurgeryBeginTime, SURGERY_END_TIME: SurgeryEndTime } = patientMeta;
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

  private getRelatedFeatures(entityName: string, itemName: string, startTime: Date, endTime: Date): string[] {
    const { featureMeta, patientMeta } = this.state;
    let relatedFeatureNames: string[] = []
    if (featureMeta && patientMeta) {
      const { SURGERY_BEGIN_TIME: SurgeryBeginTime, SURGERY_END_TIME: SurgeryEndTime } = patientMeta;
      const candidates = featureMeta.where(row => row.entityId === entityName && row.whereItem[1] === itemName);
      if (startTime < SurgeryBeginTime && endTime.getTime() > (SurgeryBeginTime.getTime() - 1000 * 60 * 60 * 24 * 2)) {
        relatedFeatureNames = relatedFeatureNames.concat(
          candidates.where(row => row.period === 'pre-surgery').getSeries('name').toArray())
      }
      if (startTime < SurgeryEndTime && endTime > SurgeryBeginTime) {
        relatedFeatureNames = relatedFeatureNames.concat(
          candidates.where(row => row.period === 'in-surgery').getSeries('name').toArray())
      }
    }
    return relatedFeatureNames
  }

  private buildRecordByPeriod(entityName: string, startTime: Date, endTime: Date): SignalMeta[] {
    const entity = this.state.tableRecords?.find(e => e.name === entityName);
    const { item_index, time_index, value_indexes } = entity?.metaInfo!;
    if (entity && item_index && time_index && value_indexes && value_indexes.length > 0) {
      const selectedDf = entity.where(row => startTime < new Date(row[time_index]) && new Date(row[time_index]) < endTime)
        .groupBy(row => (row[item_index])).where(group => group.first()[item_index] !== 'SV1');
      let records: SignalMeta[] = [];
      for (const itemDf of selectedDf) {
        const itemRecords: SignalMeta[] = value_indexes.map(value_index => {
          const itemName = itemDf.first()[item_index];
          return {
            tableName: entity.name!,
            columnName: value_index,
            itemName: itemName,
            startTime: startTime,
            endTime: endTime,
            // TODO: check this
            relatedFeatureNames: this.getRelatedFeatures(entityName, itemName, startTime, endTime)
          }
        })
        records = [...records, ...itemRecords]
      }
      return records;
    }
    else
      return [];
  }

  private updateSignalFromTimeline(entityName: string, startDate: Date, endDate: Date) {
    const newRecords = this.buildRecordByPeriod(entityName, startDate, endDate);
    this.updateSignals(newRecords);
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

  private updateTableView(tableName: string, startTime: Date, endTime: Date, itemList: string[]) {
    const tableViewMeta: TableMeta = { tableName, startTime, endTime, itemList };
    this.setState({ tableViewMeta, showTableView: true });
  }

  private updateTableViewFromFeatures(feature: Feature) {
    const { period, entityId } = feature;
    const { patientMeta } = this.state;
    // feature groups with multiple entities are not supported
    const getItemList = (feature: Feature) => {
      const item = feature.whereItem.length > 1 ? feature.whereItem[1] : undefined;
      let items = item ? [item] : [];
      if (feature.children)
        for (const child of feature.children) {
          items = items.concat(getItemList(child));
        }
      return items
    }
    if (patientMeta && entityId) {
      const { SURGERY_BEGIN_TIME: SurgeryBeginTime, SURGERY_END_TIME: SurgeryEndTime } = patientMeta;
      const startTime = (period === 'in-surgery') ? SurgeryBeginTime :
        new Date(SurgeryBeginTime.getTime() - 1000 * 60 * 60 * 24 * 2);
      const endTime = (period === 'in-surgery') ? SurgeryEndTime : SurgeryBeginTime;
      const tableName = entityId;
      const items = getItemList(feature);
      this.updateTableView(tableName, startTime, endTime, items);
    }
  }

  private showDrawer = () => {
    const visible = true
    this.setState({ visible })
  };

  private onClose = () => {
    const visible = false
    this.setState({ visible })
  };
  
  private tableNamesChange(name: string) {
    if (name == 'LABEVENTS')
      return 'Lab Tests'
    if (name == 'SURGERY_VITAL_SIGNS')
      return 'Vital Signs'
    if (name == 'CHARTEVENTS')
      return 'Chart Events'
    return 'Prescriptions'
  }


  private entityCategoricalColor(entityName?: string) {
    const { tableNames } = this.state;
    if (entityName && ['Demographic', 'Admission', 'Surgery', 'Patient Info', 'Surgery Info',
      'SURGERY_INFO', 'ADMISSIONS', 'PATIENTS'].includes(entityName))
      return defaultCategoricalColor(8);
    else if (tableNames && entityName) {
      let i = (tableNames?.indexOf(entityName) + 4);
      return defaultCategoricalColor(i);
    }
    else {
      return "#aaa"
    }
  }

  private abnormalityColor(abnormality: number) {
    return this.abnormalityColorScale(Math.max(Math.min(abnormality, 2.5), 1));
  }

  private paintLink() {
    const { signalMetas } = this.state;
    const { timelineViewHeight } = this.layout;

    const headerHeight = document.getElementById('header')?.offsetHeight || 0;
    const positions = signalMetas.map(signal => {
      const end = getOffsetById(`temporal-view-element-${signal.itemName}`);
      if (end && end.top > (headerHeight + timelineViewHeight + 30)
        && end.bottom < window.innerHeight) {
        const starts = signal.relatedFeatureNames.map(featureName =>
          getOffsetById(`feature-view-element-${featureName}`))
          .filter(isDefined)
          .filter(start => (start.top > 30 + headerHeight) &&
            (start.bottom < window.innerHeight + 20))
          ;
        return starts.map((start, i) => ({
          start: start,
          end: end,
          x1: start.right,
          y1: (start.top + start.bottom) / 2,
          x2: end.left,
          y2: (end.top + end.bottom) / 2,
          color: this.entityCategoricalColor(signal.tableName)
        }))
      }
    }).filter(isDefined).filter(d => d.length > 0);

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
        .attr('d', d => {
          const delta = (d.x2 - d.x1) / 2;
          const path = d3.path();
          path.moveTo(d.x1, d.y1);
          path.bezierCurveTo(d.x1 + delta, d.y1, d.x2 - delta, d.y2, d.x2, d.y2);
          return path.toString()
        })
        // .style('fill', d => d.color)
        .style('stroke', d => d.color);
      base.selectAll(".between-view-dot")
        .data(positions)
        .join(
          enter => enter.append("circle")
            .attr("class", "between-view-dot"),
          update => update,
          exit => exit.remove()
        )
        .attr("cx", d => d[0].x2)
        .attr("cy", d => d[0].y2)
        .attr("r", 3)
        .style('fill', d => d[0].color);
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

    const { subjectIds, patientMeta, tableNames, tableRecords, featureMeta, predictionTargets, showTableView,
      focusedFeatures, pinnedfocusedFeatures, target: selected, predictions, tableViewMeta,
      itemDicts, signalMetas, filterRange, visible, patientGroup, referenceValues } = this.state;
    const { headerHeight, featureViewWidth, timelineViewHeight, ProfileWidth, xPadding, yPadding } = this.layout;

    return (
      <div className='App'>

        <Layout>
          <Header className="app-header" id="header" style={{ background: '#001529' }}>

            <span className='system-name'>VBridge</span>
            <div className='system-info'>
              <div className='system-widget'>

                <div className='legend-area'>
                  <div className="category-legend-container">

                    {tableNames && tableNames.map(name =>
                      <div className="legend-block" key={name}>
                        <div className='legend-rect' style={{ backgroundColor: this.entityCategoricalColor(name) }} />
                        <span className='legend-name'>{this.tableNamesChange(name)}</span>
                      </div>
                    )}
                    <div className="legend-block">
                      <div className='legend-rect' style={{ backgroundColor: this.entityCategoricalColor('Admission') }} />
                      <span className='legend-name'>{"Patient & Surgery info"}</span>
                    </div>
                  </div>
                  <div className='healthy-legend'>
                    <div className="legend-block">
                      <div className='legend-rect' style={{ backgroundColor: 'rgb(242, 142, 44)' }} />
                      <span className='legend-name'>{"High Risk"}</span>
                    </div>
                    <div className="legend-block">
                      <div className='legend-rect' style={{ backgroundColor: 'rgb(78, 121, 167)' }} />
                      <span className='legend-name'>{"Low Risk"}</span>
                    </div>
                  </div>
                </div>
                <span className='header-name'>Patient: </span>
                <div className='header-content'>
                  <Select style={{ width: 120 }} onChange={this.selectPatientId} className="patient-selector">
                    {subjectIds && subjectIds.map((id, i) =>
                      <Option value={id} key={i}>{id}</Option>
                    )}
                  </Select>
                </div>
                <div className='header-content predictions'>
                  {predictionTargets && predictionTargets.filter(t => t !== 'complication').map((name, i) =>
                    <Tooltip title={name} placement="top" key={name}>
                      <div className={'prediction-icon' + (selected && name === selected ? " selected" : "") +
                        ((predictions && predictions(name) > 0.5000) ? " active" : " inactive")}
                        onClick={() => this.setState({ target: name })}>
                        <span>{name.toUpperCase()[0]} </span>
                      </div>
                    </Tooltip>
                  )}
                </div>

                <span className='header-name'>#Group:</span>
                <span className="header-name"> {`${patientGroup && patientGroup.ids ? patientGroup.ids.length : 0}
                    (${patientGroup ? patientGroup.labelCounts[5] : 0})`} </span>
                <Tooltip title="Filter">
                  <Button type="primary" shape="circle" icon={<FilterOutlined />} onClick={this.showDrawer} style={{ zIndex: 1 }} />
                </Tooltip>
              </div>
            </div>
          </Header>
          <Content>
            <Panel initialWidth={featureViewWidth}
              initialHeight={window.innerHeight - headerHeight - yPadding * 2} x={xPadding} y={yPadding}
              title={<div className="view-title">
                <span className="view-title-text">Feature View</span>
                <div className="widget">
                  <span className="widget-text">focus</span>
                  <Switch onChange={e => this.setState({ featureViewDense: e })} style={{ float: 'right' }}
                    checkedChildren="on" unCheckedChildren="off" />
                </div>
              </div>}>
              {featureMeta && tableNames && selected && predictions && <FeatureView
                className={"feature-view-element"}
                patientMeta={patientMeta}
                featureMeta={featureMeta}
                prediction={predictions(selected)}
                selectedIds={patientGroup && patientGroup.ids}
                itemDicts={itemDicts}
                entityCategoricalColor={this.entityCategoricalColor}
                focusedFeatures={[...pinnedfocusedFeatures, ...focusedFeatures]}
                inspectFeatureInSignal={this.updateSignalsByFeature}
                inspectFeatureInTable={this.updateTableViewFromFeatures}
                display={this.state.featureViewDense ? 'dense' : 'normal'}
                target={selected}
              />}
            </Panel>
            {/* <Panel initialWidth={layout.timelineViewWidth} initialHeight={layout.timelineViewHeight}
             */}
            <Panel initialWidth={window.innerWidth - featureViewWidth - ProfileWidth - xPadding * 4}
              initialHeight={timelineViewHeight}
              x={featureViewWidth + xPadding * 2} y={yPadding}
              title={<div className="view-title">
                <span className="view-title-text">Timeline View</span>
              </div>}>
              {patientMeta && featureMeta && tableNames && tableRecords && referenceValues && <TimelineView
                tableNames={tableNames}
                patientMeta={patientMeta}
                featureMeta={featureMeta}
                tableRecords={tableRecords}
                onSelectEvents={this.updateSignalFromTimeline}
                entityCategoricalColor={this.entityCategoricalColor}
                referenceValues={referenceValues}
              />}
            </Panel>

            <Panel initialWidth={window.innerWidth - featureViewWidth - ProfileWidth - xPadding * 4}
              initialHeight={window.innerHeight - headerHeight - timelineViewHeight - yPadding * 3}
              x={featureViewWidth + xPadding * 2} y={timelineViewHeight + yPadding * 2}
              title={
                <div className="view-title">
                  <span className="view-title-text">Temporal View</span>
                  <div className="widget">
                    <span className="widget-text">link</span>
                    <Switch onChange={e => this.setState({ dynamicViewLink: e })} checkedChildren="on" unCheckedChildren="off" />
                    {/*<span className="widget-text">align</span>
                    <Switch onChange={e => this.setState({ dynamicViewAlign: e })} checkedChildren="on" unCheckedChildren="off" />*/}
                  </div>
                </div>
              }>
              {patientMeta && featureMeta && tableRecords && <DynamicView
                className={"temporal-view-element"}
                align={true}
                patientMeta={patientMeta}
                featureMeta={featureMeta}
                tableRecords={tableRecords}
                signalMetas={signalMetas}
                width={window.innerWidth - featureViewWidth - ProfileWidth - 60 - xPadding * 4}
                itemDicts={itemDicts}
                color={this.entityCategoricalColor}
                updateFocusedFeatures={this.updateFocusedFeatures}
                updatePinnedFocusedFeatures={this.updatePinnedFocusedFeatures}
                pinSignal={this.pinSignal}
                removeSignal={this.removeSignal}
                referenceValues={referenceValues}
              />}
            </Panel>
            <Panel initialWidth={ProfileWidth} initialHeight={window.innerHeight - headerHeight - 2 * yPadding}
              x={window.innerWidth - xPadding - ProfileWidth} y={yPadding}
              title={<div className="view-title">
                <span className="view-title-text">Patient's Profile</span>
                <div className="widget">
                  <span className="widget-text">link</span>
                  <Switch onChange={e => this.setState({ dynamicViewLink: e })} checkedChildren="on" unCheckedChildren="off" />
                </div>
              </div>}>
              {tableNames && featureMeta && <MetaView
                className={"meta-view-element"}
                patientIds={subjectIds}
                featureMeta={featureMeta}
                patientInfoMeta={patientMeta}
                updateFocusedFeatures={this.updateFocusedFeatures}
                updatePinnedFocusedFeatures={this.updatePinnedFocusedFeatures}
                entityCategoricalColor={this.entityCategoricalColor}
                days={patientMeta && patientMeta.days}
              />
              }
            </Panel>
            {showTableView && tableNames && featureMeta && <Panel initialWidth={400} initialHeight={435} x={1010} y={405}
              title={<div className="view-title">
                <span className="view-title-text">{tableViewMeta?.tableName}</span>
                <div className="widget">
                  <Button icon={<CloseOutlined />} type="link" onClick={() => this.setState({ showTableView: false })} />
                </div>
              </div>}>
              {tableViewMeta && tableRecords && <TableView
                featureMeta={featureMeta}
                patientMeta={patientMeta}
                tableNames={tableNames}
                itemDicts={itemDicts}
                tableMeta={tableViewMeta}
                tableRecords={tableRecords}
              />}
            </Panel>
            }
            <svg className="app-link-svg" ref={this.ref} style={{ height: window.innerHeight - headerHeight }} />
            {tableNames &&
              <Drawer maskClosable={false} title="Filter View" placement="right" closable={false}
                onClose={this.onClose} visible={visible} width={450} >
                <p>
                  <FilterView
                    filterRange={filterRange}
                    filterPatients={this.filterPatients}
                    onClose={this.onClose}
                    patientMeta={patientMeta}
                    visible={visible}
                    subjectIdG={patientGroup && patientGroup.ids}
                    distributionApp={patientGroup?.labelCounts}
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

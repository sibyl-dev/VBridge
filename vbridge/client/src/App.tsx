import React from 'react';
import * as d3 from "d3";
import * as _ from 'lodash';

import { Layout, Drawer, Tooltip, Button, Select, Switch } from 'antd';
import { FilterOutlined } from '@ant-design/icons';
import { CloseOutlined } from '@material-ui/icons';

import Panel from 'components/Panel';
import MetaView from "./components/MetaView";
import DynamicView from "./components/DynamicView"
import FeatureView from 'components/FeatureView';
import TableView, { TableMeta } from "./components/TableView";
import TimelineView from "./components/TimelineView";
// import FilterView from "./components/FilterView"

import API from "./router/api"
import { EntitySetSchema, ReferenceValueResponse, Task, FeatureSchemaResponse } from 'type/resource';
import { Entity, Feature, buildFeatures, PatientInfo, buildPatientInfo, SignalMeta, buildSignalsByFeature, getRelatedFeatures, buildRecordByPeriod } from './type';

import { DataFrame, IDataFrame } from 'data-forge';
import { distinct, isDefined } from 'utils/common';

import { defaultCategoricalColor, getChildOrAppend, getOffsetById } from 'visualization/common';

import './App.css';

const { Header, Content } = Layout;
const { Option } = Select;

interface AppProps { }

interface AppStates {
  //task
  task?: Task,

  // static information
  directIds?: string[],
  entitySetSchema?: EntitySetSchema
  featureSchema?: FeatureSchemaResponse,

  //patient information
  target?: string,
  patientInfo?: PatientInfo,
  features?: IDataFrame<number, any>,

  //cohort information
  selectedIds?: number[],
  featureMat?: IDataFrame<number, any>,
  referenceValues?: ReferenceValueResponse,

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
  // filterRange?: filterType,
  // patientGroup?: PatientGroup,
  // conditions?: { [key: string]: any },

  // others
  visible?: boolean,
}

class App extends React.Component<AppProps, AppStates>{
  private layout = { featureViewWidth: 520, ProfileWidth: 280, timelineViewHeight: 220, headerHeight: 64, xPadding: 15, yPadding: 5 };
  private ref: React.RefObject<SVGSVGElement> = React.createRef();
  private paintId: any = undefined;

  constructor(props: AppProps) {
    super(props);
    this.state = {
      signalMetas: [], pinnedSignalMetas: [],
      focusedFeatures: [], pinnedfocusedFeatures: [], showTableView: false,
      featureViewDense: false, dynamicViewLink: false, dynamicViewAlign: false
    };

    this.loadPatientInfo = this.loadPatientInfo.bind(this);
    this.loadFeatures = this.loadFeatures.bind(this);

    this.onSelectDirectId = this.onSelectDirectId.bind(this);
    this.onSelectTarget = this.onSelectTarget.bind(this);
    // this.filterPatients = this.filterPatients.bind(this)
    // this.showDrawer = this.showDrawer.bind(this);

    // // Call-backs to update the Temporal View
    this.updateSignals = this.updateSignals.bind(this);
    this.updateSignalsByFeature = this.updateSignalsByFeature.bind(this);
    this.updateSignalFromTimeline = this.updateSignalFromTimeline.bind(this);
    this.pinSignal = this.pinSignal.bind(this);
    this.removeSignal = this.removeSignal.bind(this);

    this.updateTableView = this.updateTableView.bind(this);
    this.updateTableViewFromFeatures = this.updateTableViewFromFeatures.bind(this);

    // // Call-backs to update the Feature View
    this.updateFocusedFeatures = this.updateFocusedFeatures.bind(this);
    this.updatePinnedFocusedFeatures = this.updatePinnedFocusedFeatures.bind(this);

    this.entityCategoricalColor = this.entityCategoricalColor.bind(this);

    this.paintLink = this.paintLink.bind(this);
    this.removeLink = this.removeLink.bind(this);
  }

  componentDidMount() {
    this.init();
  }

  componentWillUnmount() {
    window.clearInterval(this.paintId);
  }

  componentDidUpdate(prevProps: AppProps, prevState: AppStates) {
    const { dynamicViewLink } = this.state;
    if (prevState.dynamicViewLink !== dynamicViewLink) {
      if (dynamicViewLink) {
        this.paintId = setInterval(this.paintLink);
      }
      else {
        window.clearInterval(this.paintId);
        this.removeLink();
      }
    }
  }

  public async init() {
    const directIds = ["103784"]; //TODO - fetch it from backend
    const task = await API.task.all();
    const target = task && Object.keys(task.labels)[0];
    const featureSchema = await API.featureSchemas.all();
    const entitySetSchema = await API.entitySchemas.all();
    const referenceValues = await API.referenceValues.all();
    // const featureMat = await API.featureValues.all();

    this.setState({ directIds, task, target, featureSchema, entitySetSchema, referenceValues });
  }

  private async loadPatientInfo(directId: string) {
    const { entitySetSchema } = this.state;
    const patient = await API.patient.find(directId);
    const prediction = await API.predictions.find(directId);
    if (entitySetSchema && patient && prediction) {
      const patientInfo = buildPatientInfo(directId, patient, entitySetSchema, prediction);
      this.setState({ patientInfo });
    }
  }

  private async loadFeatures(directId: string) {
    const { featureSchema, target } = this.state;
    if (featureSchema && target) {
      const featureValues = await API.featureValues.find(directId);
      const shap = await API.shapValues.find(directId, {}, { target: target });
      const whatIfShap = await API.cfShapValues.find(directId, {}, { target: target });
      if (featureValues) {
        const features = buildFeatures(featureSchema, featureValues, shap, whatIfShap);
        this.setState({ features });
      }
    }
  }

  private onSelectDirectId(directId: string) {
    this.loadPatientInfo(directId);
    this.loadFeatures(directId);
    this.setState({ pinnedSignalMetas: [] });
  }

  private onSelectTarget(target: string) {
    this.setState({ target }, this.loadFeatures.bind(this, this.state.patientInfo?.id!));
  }

  /******************************************************************************************/

  private updateSignalsByFeature(feature: Feature) {
    const { patientInfo, referenceValues } = this.state
    if (patientInfo) {
      const newSignals = buildSignalsByFeature({
        feature, temporal: patientInfo.temporal, referenceValues
      });
      this.updateSignals(newSignals);
    }
  }

  private updateSignals(newSignalMeta: SignalMeta[]) {
    const rawSignalMeta = new DataFrame([...this.state.pinnedSignalMetas, ...newSignalMeta]);
    const signalMetas: SignalMeta[] = rawSignalMeta.groupBy(row => row.itemId).toArray().map(group => {
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
    const pinnedSignalNames = pinnedSignalMetas.map(s => `${s.itemId}`);
    if (pinnedSignalNames.includes(signalMeta.itemId)) {
      this.setState({ pinnedSignalMetas: pinnedSignalMetas.filter(s => s.itemId !== signalMeta.itemId) });
    }
    else {
      pinnedSignalMetas.push(signalMeta);
      this.setState({ pinnedSignalMetas: pinnedSignalMetas });
    }
  }

  private removeSignal(targetSignal: SignalMeta) {
    const { pinnedSignalMetas, signalMetas } = this.state;
    this.setState({
      pinnedSignalMetas: pinnedSignalMetas.filter(s => s.itemId !== targetSignal.itemId),
      signalMetas: signalMetas.filter(s => s.itemId !== targetSignal.itemId),
    });
  }

  private updateSignalFromTimeline(entityId: string, startTime: Date, endTime: Date) {
    const { featureSchema, patientInfo, referenceValues } = this.state;
    const entity = patientInfo!.temporal.find(e => e.id === entityId);
    const newRecords = buildRecordByPeriod({
      entity: entity!, featureSchema: featureSchema!,
      startTime, endTime, referenceValues
    });
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

  private updateTableView(tableName: string, itemList?: string[], startTime?: Date, endTime?: Date) {
    const tableViewMeta: TableMeta = { entityId: tableName, startTime, endTime, itemList };
    this.setState({ tableViewMeta, showTableView: true });
  }

  private updateTableViewFromFeatures(feature: Feature) {
    const { entityId } = feature;
    const { patientInfo } = this.state;
    // feature groups with multiple entities are not supported
    const getItemList = (feature: Feature) => {
      const item = feature.item?.itemId;
      let items = item ? [item] : [];
      if (feature.children)
        for (const child of feature.children) {
          items = items.concat(getItemList(child));
        }
      return items
    }
    if (patientInfo) {
      const tableName = entityId;
      const items = getItemList(feature);
      this.updateTableView(tableName, items);
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

  private entityCategoricalColor(entityName?: string) {
    const { entitySetSchema } = this.state;
    if (entityName && ['Demographic', 'Admission', 'Surgery', 'Patient Info', 'Surgery Info',
      'SURGERY_INFO', 'ADMISSIONS', 'PATIENTS'].includes(entityName))
      return defaultCategoricalColor(8);
    else if (entitySetSchema && entityName) {
      let i = (entitySetSchema.map(d => d.entityId).indexOf(entityName) + 4);
      return defaultCategoricalColor(i);
    }
    else {
      return "#aaa"
    }
  }

  private paintLink() {
    const { signalMetas } = this.state;
    const { timelineViewHeight } = this.layout;

    const headerHeight = document.getElementById('header')?.offsetHeight || 0;
    const positions = signalMetas.map(signal => {
      const end = getOffsetById(`temporal-view-element-${signal.itemId}`);
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
          color: this.entityCategoricalColor(signal.entityId)
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

    const { directIds: subjectIds, entitySetSchema, patientInfo, featureSchema, features, showTableView, featureMat,
      focusedFeatures, pinnedfocusedFeatures, target, tableViewMeta, signalMetas, visible, referenceValues } = this.state;
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
                    {entitySetSchema?.map(entity =>
                      <div className="legend-block" key={entity.entityId}>
                        <div className='legend-rect' style={{ backgroundColor: this.entityCategoricalColor(entity.entityId) }} />
                        <span className='legend-name'>{entity.alias || entity.entityId}</span>
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
                  <Select style={{ width: 120 }} onChange={this.onSelectDirectId} className="patient-selector">
                    {subjectIds && subjectIds.map((id, i) =>
                      <Option value={id} key={i}>{id}</Option>
                    )}
                  </Select>
                </div>
                {/* <div className='header-content predictions'>
                  {targetSchema?.where(d => d.id !== 'complication').select(d =>
                    <Tooltip title={d.id} placement="top" key={d.id}>
                      <div className={'prediction-icon' + (target && d.id === target ? " selected" : "") +
                        ((predictions && predictions[d.id] > 0.5000) ? " active" : " inactive")}
                        onClick={() => this.selectPredictionTarget(d.id)}>
                        <span>{d.id.toUpperCase()[0]} </span>
                      </div>
                    </Tooltip>
                  )}
                </div> */}

                <span className='header-name'>#Group:</span>
                {/* <span className="header-name"> {`${patientGroup && patientGroup.ids ? patientGroup.ids.length : 0}
                    (${patientGroup ? patientGroup.labelCounts[5] : 0})`} </span> */}
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
              {patientInfo && features && target &&
                <FeatureView
                  className={"feature-view-element"}
                  features={features}
                  featureMat={featureMat}
                  prediction={patientInfo.prediction[target]}
                  // selectedIds={patientGroup && patientGroup.ids}
                  entityCategoricalColor={this.entityCategoricalColor}
                  focusedFeatures={[...pinnedfocusedFeatures, ...focusedFeatures]}
                  inspectFeatureInSignal={this.updateSignalsByFeature}
                  inspectFeatureInTable={this.updateTableViewFromFeatures}
                  display={this.state.featureViewDense ? 'dense' : 'normal'}
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
              {patientInfo && featureSchema && entitySetSchema &&
                <TimelineView
                  tableNames={entitySetSchema.map(d => d.entityId)}
                  featureSchema={featureSchema}
                  entities={patientInfo.temporal}
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
                  </div>
                </div>
              }>
              {patientInfo && featureSchema &&
                <DynamicView
                  className={"temporal-view-element"}
                  align={true}
                  patientTemporals={patientInfo.temporal}
                  signalMetas={signalMetas}
                  width={window.innerWidth - featureViewWidth - ProfileWidth - 60 - xPadding * 4}
                  color={this.entityCategoricalColor}
                  updateFocusedFeatures={this.updateFocusedFeatures}
                  updatePinnedFocusedFeatures={this.updatePinnedFocusedFeatures}
                  pinSignal={this.pinSignal}
                  removeSignal={this.removeSignal}
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
              {featureSchema && <MetaView
                className={"meta-view-element"}
                patientStatics={patientInfo?.static}
                updateFocusedFeatures={this.updateFocusedFeatures}
                updatePinnedFocusedFeatures={this.updatePinnedFocusedFeatures}
                entityCategoricalColor={this.entityCategoricalColor}
                featureSchema={featureSchema}
              />
              }
            </Panel>
            {showTableView && <Panel initialWidth={400} initialHeight={435} x={1010} y={405}
              title={<div className="view-title">
                <span className="view-title-text">{tableViewMeta?.entityId}</span>
                <div className="widget">
                  <Button icon={<CloseOutlined />} type="link" onClick={() => this.setState({ showTableView: false })} />
                </div>
              </div>}>
              {patientInfo && tableViewMeta &&
                <TableView
                  tableMeta={tableViewMeta}
                  tableRecords={patientInfo.temporal}
                />}
            </Panel>
            }
            <svg className="app-link-svg" ref={this.ref} style={{ height: window.innerHeight - headerHeight }} />
            {/* {tableNames &&
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
            } */}


          </Content>
        </Layout>

      </div>

    )
  }
}

export default App;

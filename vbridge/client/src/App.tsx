import React from 'react';
import * as _ from 'lodash';

import { Layout, Drawer, Button, Switch } from 'antd';
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
import { Feature, buildFeatures, PatientInfo, buildPatientInfo, SignalMeta, buildSignalsByFeature, buildRecordByPeriod } from './type';

import { DataFrame, IDataFrame, fromCSV } from 'data-forge';
import { distinct } from 'utils/common';

import './App.css';
import Links from 'visualization/Links';
import { AppHeader } from 'components/Header';
import { ColorManager } from 'visualization/color';

const { Header, Content } = Layout;

interface AppProps { }

interface AppStates {
  //task
  task?: Task,
  colorManager?: ColorManager,

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
  private layout = { featureViewWidth: 520, profileHeight: 280, timelineViewHeight: 220, headerHeight: 64 };

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
  }

  componentDidMount() {
    this.init();
  }

  public async init() {
    const directIds = ["103784"]; //TODO - fetch it from backend
    const task = await API.task.all();
    const target = task && Object.keys(task.labels)[0];
    const colorManager = task && new ColorManager(task);
    const featureSchema = await API.featureSchemas.all();
    const entitySetSchema = await API.entitySchemas.all();
    const referenceValues = await API.referenceValues.all();
    const featureMatResponse = await API.featureValues.all();
    const featureMat = featureMatResponse ? fromCSV(featureMatResponse) : undefined;

    this.setState({ directIds, task, target, featureSchema, entitySetSchema, referenceValues, featureMat, colorManager });
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

  public render() {

    const { directIds, entitySetSchema, patientInfo, featureSchema, features, showTableView, featureMat, task, colorManager,
      focusedFeatures, pinnedfocusedFeatures, target, tableViewMeta, signalMetas, visible, referenceValues, dynamicViewLink } = this.state;
    const { headerHeight, featureViewWidth, timelineViewHeight, profileHeight } = this.layout;

    return (
      <div className='App'>
        <Layout>
          <Header className="app-header" id="header">
            <AppHeader
              target={target}
              task={task}
              colorManager={colorManager}
              entitySetSchema={entitySetSchema}
              directIds={directIds}
              onSelectDirectId={this.onSelectDirectId}
            />
          </Header>
          <Content className="app-content">
            <Panel initialWidth={featureViewWidth} initialHeight={profileHeight}
              title="Patient"
              widgets={[{
                name: 'link', content: <Switch onChange={e =>
                  this.setState({ dynamicViewLink: e })} checkedChildren="on" unCheckedChildren="off" />
              }]}
            >
              {featureSchema && <MetaView
                className={"meta-view-element"}
                patientStatics={patientInfo?.static}
                updateFocusedFeatures={this.updateFocusedFeatures}
                updatePinnedFocusedFeatures={this.updatePinnedFocusedFeatures}
                featureSchema={featureSchema}
                colorManager={colorManager}
              />
              }
            </Panel>
            <Panel initialWidth={featureViewWidth}
              initialHeight={window.innerHeight - headerHeight - profileHeight}
              y={profileHeight}
              title="Feature View"
              widgets={[{
                name: "focus", content: <Switch onChange={e =>
                  this.setState({ featureViewDense: e })} style={{ float: 'right' }}
                  checkedChildren="on" unCheckedChildren="off" />
              }]}
            >
              {patientInfo && features && target &&
                <FeatureView
                  className={"feature-view-element"}
                  features={features}
                  // featureMat={featureMat}
                  prediction={patientInfo.prediction[target]}
                  // selectedIds={patientGroup && patientGroup.ids}
                  focusedFeatures={[...pinnedfocusedFeatures, ...focusedFeatures]}
                  inspectFeatureInSignal={this.updateSignalsByFeature}
                  inspectFeatureInTable={this.updateTableViewFromFeatures}
                  display={this.state.featureViewDense ? 'dense' : 'normal'}

                  target={target}
                  colorManager={colorManager}
                />}
            </Panel>
            <Panel initialWidth={window.innerWidth - featureViewWidth}
              initialHeight={timelineViewHeight}
              x={featureViewWidth}
              title="Timeline View"
            >
              {patientInfo && featureSchema && entitySetSchema &&
                <TimelineView
                  tableNames={entitySetSchema.map(d => d.entityId)}
                  featureSchema={featureSchema}
                  entities={patientInfo.temporal}
                  onSelectEvents={this.updateSignalFromTimeline}
                  referenceValues={referenceValues}
                  colorManager={colorManager}
                />}
            </Panel>

            <Panel initialWidth={window.innerWidth - featureViewWidth}
              initialHeight={window.innerHeight - headerHeight - timelineViewHeight}
              x={featureViewWidth} y={timelineViewHeight}
              title="Temporal View"
              widgets={[{
                name: 'link', content: <Switch onChange={e =>
                  this.setState({ dynamicViewLink: e })} checkedChildren="on" unCheckedChildren="off" />
              }]}
            >
              {patientInfo && featureSchema &&
                <DynamicView
                  className={"temporal-view-element"}
                  directId={patientInfo.id}
                  patientTemporals={patientInfo.temporal}
                  signalMetas={signalMetas}
                  width={window.innerWidth - featureViewWidth - 60}
                  updateFocusedFeatures={this.updateFocusedFeatures}
                  updatePinnedFocusedFeatures={this.updatePinnedFocusedFeatures}
                  pinSignal={this.pinSignal}
                  removeSignal={this.removeSignal}
                  colorManager={colorManager}
                />}
            </Panel>
            {showTableView && <Panel initialWidth={400} initialHeight={435} x={1010} y={405}
              title={tableViewMeta?.entityId}
              widgets={[{
                content: <Button icon={<CloseOutlined />} type="link"
                  onClick={() => this.setState({ showTableView: false })} />
              }]}
            >
              {patientInfo && tableViewMeta &&
                <TableView
                  tableMeta={tableViewMeta}
                  tableRecords={patientInfo.temporal}
                />}
            </Panel>
            }
            {dynamicViewLink && <Links signalMetas={signalMetas} height={window.innerHeight - headerHeight}
                colorManager={colorManager}
            />}
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

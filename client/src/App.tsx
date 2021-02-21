import React from 'react';
import { Layout } from 'antd'
import './App.css';

import FeatureView from "./components/FeatureView"
import MetaView from "./components/MetaView"
import TableView from "./components/TableView"
import TimelineView from "./components/TimelineView"
import DynamicView from "./components/DynamicView"
import { getPatientMeta, getTableNames } from "./router/api"
import { PatientMeta } from 'data/patient';

const { Header, Content } = Layout

interface AppProps {

}

interface AppStates {
  patientMeta?: PatientMeta,
  tableNames?: string[],
}

class App extends React.Component<AppProps, AppStates>{
  constructor(props: AppProps) {
    super(props);
    this.state = {};
  }

  public async init() {
    const tableNames = await getTableNames();
    const patientMeta = await getPatientMeta({subject_id: 12274});
    this.setState({ tableNames, patientMeta });
  }

  public componentDidMount() {
    this.init();
  }

  public render() {
    const { patientMeta, tableNames } = this.state
    return (
      <div className='App'>
        <Layout>
          <Header>
            <p className='system-name'>Bridges</p>
          </Header>
          <Content>
            <FeatureView />
            {tableNames && <TimelineView
              patientMeta={patientMeta}
              tableNames={tableNames}
            />}
            <MetaView />
            <DynamicView />
            {tableNames && <TableView
              patientMeta={patientMeta}
              tableNames={tableNames}
            />}
          </Content>
        </Layout>
      </div>
    )
  }
}

export default App;

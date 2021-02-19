import React from 'react';
import {Layout} from 'antd'
import './App.css';

import FeatureView from "./components/FeatureView"
import MetaView from "./components/MetaView"
import TableView from "./components/TableView"
import TimelineView from "./components/TimelineView"
import DynamicView from "./components/DynamicView"
import {getTableNames} from "./router/api"

const {Header, Content} = Layout

interface AppProps {

}

interface AppStates {
  subjectId?: number,
  tableNames: string[],
}

class App extends React.Component<AppProps, AppStates>{
  constructor(props: AppProps){
    super(props)
    this.state = {
      subjectId: 3718,
      tableNames: [],
    }
  }

  public async init() {
    const tableNames = await getTableNames()
    console.log(tableNames)
    this.setState({tableNames})
  }

  public componentDidMount(){
    this.init()
  }

  public render(){
    const {subjectId, tableNames} = this.state
    return (
      <div className='App'>
        <Layout>
          <Header>
            <p className='system-name'>Bridges</p>
          </Header>
          <Content>
            <FeatureView />
            <TimelineView />
            <MetaView />
            <DynamicView />
            <TableView 
              subjectId = {subjectId}
              tableNames = {tableNames}
            />
          </Content>
        </Layout>
      </div>
    )
  }
}

export default App;

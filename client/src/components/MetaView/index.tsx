import * as React from "react";
import Panel from "../Panel"
import { PatientMeta } from "data/patient";
import { Row, Col, Select, Card, Divider} from "antd"
import "./index.css" 

const { Option } = Select;


export interface MetaViewProps {
    patientIds?: number[],
    patientMeta?: PatientMeta,
    selectPatientId?: (subjectId: number) => void,
}

export interface MetaViewStates { 
    expandItem?: boolean[],
}

export default class MetaView extends React.Component<MetaViewProps, MetaViewStates> {
    
    constructor(props: MetaViewProps) {
        super(props);
        this.state = { expandItem: [false, false, false]};
        this.handleClick = this.handleClick.bind(this);
        
    }
   
    handleClick(i:number){
        const expandItem:any  = this.state.expandItem;
        expandItem[i] = !expandItem[i]
        this.setState({
          expandItem: expandItem,
        });
    }

    public render() {
        const { selectPatientId, patientIds, patientMeta } = this.props
        const { expandItem } = this.state;
        const age = patientMeta && 
        (((new Date(patientMeta.startDate).getTime()- new Date(patientMeta.DOB).getTime())/1000/24/60/60/30 + 1).toFixed(0));

        const leftSpan:number = 5
        const titleWidth = 4
        const valueWidth = 9
        const rightSpan=2
        return (
            <div>
                <Row>
                    <Col span={10}><span className="meta-info">PatientId: </span></Col>
                    <Col span={2} />
                    <Col span={12}>
                        <Select style={{ width: 120 }} onChange={selectPatientId}>
                            {patientIds && patientIds.map((id, i) =>
                                <Option value={id} key={i}>{id}</Option>
                            )}
                        </Select>
                    </Col>
                </Row>
               
            {/*
                <Card extra='▶️' title='Patient Information' size='small' style={{marginTop:10,}}>
                    <p> 
                        <span className='details-title'> Gender :  </span>
                        <span className='details-value'> {'   '} {patientMeta && patientMeta['GENDER']}  </span>
                    </p>
                    <p> 
                        <span className='details-title'> Age :  </span>
                        <span className='details-value'> {'   '} {age} months </span>
                   </p>
                </Card>

             */}
                <Divider orientation="left"></Divider>

                <Row onClick={this.handleClick.bind(this,0)}>
                    <Col span={4}>
                       {expandItem && expandItem[0] ? <img src='tri_fold.png'  width='15px'/> : <img src='tri_unfold.png'  width='15px'/>} 
                    </Col>
                    <Col span={2}/>
                    <Col span={12}><span className="meta-info-title">Patient Information </span></Col>
                    <Col span={2} />
                </Row>

                {expandItem && expandItem[0] && patientMeta?(
                    <Row>
                        <Col span={leftSpan}/>
                        <Col span={titleWidth}><span className="details-title">Gender: </span></Col>
                        <Col span={valueWidth}><span className="details-value"> {patientMeta['GENDER']} </span></Col>
                        <Col span={rightSpan} />
                        <Col span={leftSpan}/>
                        <Col span={titleWidth}><span className="details-title">Age: </span></Col>
                        <Col span={valueWidth}><span className="details-value">{age} months</span></Col>
                        <Col span={rightSpan} />
                    </Row>
                ):""}

                 <Divider orientation="left"></Divider>

                <Row onClick={this.handleClick.bind(this,1)}>
                    <Col span={4}>
                        {expandItem && expandItem[1] ? <img src='tri_fold.png'  width='15px'/> : <img src='tri_unfold.png'  width='15px'/>}
                    </Col>
                    <Col span={2}/>
                    <Col span={12}><span className="meta-info-title">Admission Information </span></Col>
                    <Col span={2} />
                </Row>

                {expandItem && expandItem[1] && patientMeta?(
                    <Row>
                        <Col span={leftSpan}/>
                        <Col span={titleWidth}><span className="details-title">Gender: </span></Col>
                        <Col span={valueWidth}><span className="details-value"> {patientMeta['GENDER']} </span></Col>
                        <Col span={rightSpan} />
                        <Col span={leftSpan}/>
                        <Col span={titleWidth}><span className="details-title">Age: </span></Col>
                        <Col span={valueWidth}><span className="details-value">{age} months</span></Col>
                        <Col span={rightSpan} />
                    </Row>
                ):""}

                 <Divider orientation="left"></Divider>

                <Row onClick={this.handleClick.bind(this,2)}>
                    <Col span={4}>
                        {expandItem && expandItem[2] ? <img src='tri_fold.png'  width='15px'/> : <img src='tri_unfold.png'  width='15px'/>}
                    </Col>
                    <Col span={2}/>
                    <Col span={12}><span className="meta-info-title">Surgery Information </span></Col>
                    <Col span={2} />
                </Row>

                {expandItem && expandItem[2] && patientMeta?(
                    <Row>
                        <Col span={leftSpan}/>
                        <Col span={titleWidth}><span className="details-title">Gender: </span></Col>
                        <Col span={valueWidth}><span className="details-value"> {patientMeta['GENDER']} </span></Col>
                        <Col span={rightSpan} />
                        <Col span={leftSpan}/>
                        <Col span={titleWidth}><span className="details-title">Age: </span></Col>
                        <Col span={valueWidth}><span className="details-value">{age} months</span></Col>
                        <Col span={rightSpan} />
                    </Row>
                ):""}

             
                

             </div>
        )
    }
}
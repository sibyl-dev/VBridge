import * as React from "react";
import { Row, Col, Select, Card, Divider } from "antd"
import "./index.css"
import { patientInfoMeta } from 'data/metaInfo';

const { Option } = Select;


export interface MetaViewProps {
    patientIds?: number[],
    patientInfoMeta?: { [key: string]: any },
    selectPatientId?: (subjectId: number) => void,
}

export interface MetaViewStates {
    expandItem?: boolean[],
    PATIENTS?: string[],
    ADMISSIONS?: string[],
    SURGERY_INFO?: string[],
}

export default class MetaView extends React.Component<MetaViewProps, MetaViewStates> {

    constructor(props: MetaViewProps) {
        super(props);
        this.state = {
            expandItem: [false, false, false],
            PATIENTS: ['Age', 'GENDER', 'Height', 'Weight', 'LANGUAGE', 'RELIGION', 'MARITAL_STATUS', 'ETHNICITY'],
            ADMISSIONS: ['ADMITTIME', 'ADMISSION_DEPARTMENT', 'INSURANCE', 'EDREGTIME', 'DIAGNOSIS', 'ICD10_CODE_CN'],
            SURGERY_INFO: ['ANES_START_TIME',
                'ANES_END_TIME',
                'SURGERY_BEGIN_TIME',
                'SURGERY_END_TIME',
                'SURGERY_NAME',
                'ANES_METHOD',
                'SURGERY_POSITION',
                'Preoperative oxygen saturation (%)',
                'Oxygen saturation (%)',
                'Surgical time (minutes)',
                'CPB time (minutes)',
                'Aortic cross-clamping time (times)'
            ],

        };
        this.handleClick = this.handleClick.bind(this);

    }

    handleClick(i: number) {
        const expandItem: any = this.state.expandItem;
        expandItem[i] = !expandItem[i]
        this.setState({
            expandItem: expandItem,
        });
    }

    public render() {
        const { selectPatientId, patientIds, patientInfoMeta } = this.props
        const { expandItem, PATIENTS, ADMISSIONS, SURGERY_INFO } = this.state;
        // console.log("PATIENTS", PATIENTS)

        // const patientMetaName = interesting_info_meta['PATIENTS']
        // const admissionMetaName = interesting_info_meta['ADMISSIONS']
        // const surgeryMetaName = interesting_info_meta['SURGERY_INFO']

        // const age = patientInfoMeta && 
        // (((new Date(patientInfoMeta.startDate).getTime()- new Date(patientInfoMeta.DOB).getTime())/1000/24/60/60/30 + 1).toFixed(0));

        const leftSpan = 0;
        const titleWidth = 10;
        const middleSpan = 1;
        const valueWidth = 11;
        const rightSpan = 0;
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

                <Divider className='metaInfoTitle' orientation="center"> Demographic </Divider>

                {patientInfoMeta ? (
                    <Row>
                        {PATIENTS ? PATIENTS.map(name => {
                            var value = patientInfoMeta[name]
                            if (name.indexOf("TIME") != -1) {
                                console.log('TIME', name)
                                value = value.substr(11, 8)
                            }
                            name = name.replace(/_/g, " ")
                            return (<>
                                <Col span={leftSpan} />
                                <Col span={titleWidth}><span className="details-title"> {name}: </span></Col>
                                <Col span={middleSpan} />
                                <Col span={valueWidth}>
                                    <div className='value' >{value}</div>
                                </Col>
                                <Col span={rightSpan} />
                            </>)
                        }) : ""}
                    </Row>

                ) : ""}

                <Divider className='metaInfoTitle' orientation="center"> Admission </Divider>

                {patientInfoMeta ? (
                    <Row>
                        {ADMISSIONS ? ADMISSIONS.map(name => {
                            var value = patientInfoMeta[name]
                            if (name.indexOf("TIME") != -1) {
                                console.log('TIME', name)
                                value = value.substr(11, 8)
                            }
                            name = name.replace(/_/g, " ")

                            return (<>
                                <Col span={leftSpan} />
                                <Col span={titleWidth}><span className="details-title"> {name}: </span></Col>
                                <Col span={middleSpan} />
                                <Col span={valueWidth}>
                                    <div className='value' >{value}</div>
                                </Col>
                                <Col span={rightSpan} />
                            </>)
                        }) : ""}
                    </Row>
                ) : ""}

                <Divider className='metaInfoTitle' orientation="center"> Surgery </Divider>

                {patientInfoMeta ? (
                    <Row>
                        {SURGERY_INFO ? SURGERY_INFO.map(name => {
                            var value = patientInfoMeta[name]
                            if (name.indexOf("TIME") != -1) {
                                console.log('TIME', name)
                                value = value.substr(11, 8)
                            }
                            name = name.replace(/_/g, " ")

                            return (<>
                                <Col span={leftSpan} />
                                <Col span={titleWidth}><span className="details-title"> {name}: </span></Col>
                                <Col span={middleSpan} />
                                <Col span={valueWidth}>
                                    <div className='value' >{value}</div>
                                </Col>
                                <Col span={rightSpan} />
                            </>)
                        }) : ""}
                    </Row>

                ) : ""}
            </div>
        )
    }
}
import * as React from "react";
import { Row, Col, Select, Card, Divider } from "antd"
import "./index.css"
import { beautifulPrinter } from "visualization/common";

const { Option } = Select;

export interface MetaViewProps {
    patientIds?: number[],
    patientInfoMeta?: { [key: string]: any },
    selectPatientId?: (subjectId: number) => void,
}

export interface MetaViewStates {
    expandItem?: boolean[],
}

export type MetaItems = {
    name: string,
    itemNames: string[],
}

export default class MetaView extends React.Component<MetaViewProps, MetaViewStates> {

    private metaItems: MetaItems[];
    private layout: number[] = [0, 10, 1, 11, 0];

    constructor(props: MetaViewProps) {
        super(props);
        this.state = {
            expandItem: [false, false, false],
        };
        this.metaItems = [
            {
                name: 'Demographic',
                itemNames: ['Age', 'GENDER', 'Height', 'Weight', 'LANGUAGE', 'RELIGION', 'MARITAL_STATUS', 'ETHNICITY']
            },
            {
                name: 'Admission',
                itemNames: ['ADMITTIME', 'ADMISSION_DEPARTMENT', 'INSURANCE', 'EDREGTIME', 'DIAGNOSIS', 'ICD10_CODE_CN']
            },
            {
                name: 'Surgery',
                itemNames: ['ANES_START_TIME', 'ANES_END_TIME', 'SURGERY_BEGIN_TIME', 'SURGERY_END_TIME',
                    'SURGERY_NAME', 'SURGERY_POSITION', 'ANES_METHOD',
                    'Preoperative oxygen saturation (%)', 'Oxygen saturation (%)',
                    'Surgical time (minutes)', 'CPB time (minutes)', 'Aortic cross-clamping time (times)'
                ]
            }
        ]
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
        const { expandItem } = this.state;

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
                {patientInfoMeta && this.metaItems.map(metaItem => <div key={metaItem.name}>
                    <Divider className='metaInfoTitle' orientation="center"> {metaItem.name} </Divider>
                        {metaItem.itemNames.map(name => {
                            var value = patientInfoMeta[name]
                            if (name.indexOf("TIME") != -1) {
                                // console.log('TIME', name);
                                value = value.substr(11, 8);
                            }
                            name = name.replace(/_/g, " ");
                            return <Row key={name}>
                                <Col span={this.layout[0]} />
                                <Col span={this.layout[1]}><span className="details-title"> {name}: </span></Col>
                                <Col span={this.layout[2]} />
                                <Col span={this.layout[3]}>
                                    <div className='value' >{value}</div>
                                </Col>
                                <Col span={this.layout[4]} />
                            </Row>
                        })}
                </div>
                )}
            </div>
        )
    }
}
import * as React from "react";
import { Row, Col, Divider } from "antd"
import { beautifulPrinter } from "visualization/common";
import "./index.scss"

export interface MetaViewProps {
    patientIds?: number[],
    patientInfoMeta?: { [key: string]: any },
}

export interface MetaViewStates { }

export type MetaItems = {
    name: string,
    itemNames: string[],
}

export default class MetaView extends React.Component<MetaViewProps, MetaViewStates> {

    private metaItems: MetaItems[];
    private layout: number[] = [1, 10, 1, 11, 1];

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
    }

    public render() {
        const { patientInfoMeta } = this.props

        return (
            <div className={"meta-view"}>
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
                            <Col span={this.layout[1]}>
                                <span className="details-title"> {name}: </span>
                            </Col>
                            <Col span={this.layout[2]} />
                            <Col span={this.layout[3]}>
                                <div className={`value ${metaItem.name}`} >{value}</div>
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
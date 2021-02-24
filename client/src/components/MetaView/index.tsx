import * as React from "react";
import Panel from "../Panel"
import { Row, Col, Select } from "antd"
import "./index.css"

const { Option } = Select;


export interface MetaViewProps {
    patientIds?: number[],
    selectPatientId?: (subjectId: number) => void,
}

export interface MetaViewStates { }

export default class MetaView extends React.Component<MetaViewProps, MetaViewStates> {
    public render() {
        const { selectPatientId, patientIds } = this.props
        return (
            <Panel initialWidth={300} initialHeight={400} x={1110} y={0}>
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
            </Panel>
        )
    }
}
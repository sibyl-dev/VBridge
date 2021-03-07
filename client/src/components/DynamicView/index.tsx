import { Button, Card, Select } from "antd";
import { PatientMeta } from "data/patient";
import { Entity, ItemDict } from "data/table";
import * as React from "react";
import { DataFrame, ISeries } from "data-forge"
import { defaultMargin, getMargin, getScaleTime, MarginType } from "visualization/common";
import { drawLineChart } from "visualization/lineChart";
import Search from "antd/lib/input/Search";
import "./index.css"
import { CloseOutlined, MinusOutlined, PushpinOutlined } from "@ant-design/icons";

export interface RecordTS {
    tableName: string,
    itemName: string,
    startTime?: Date,
    endTime?: Date,
    data: { dates: ISeries<number, Date>, values: ISeries<number, any> },
}

export interface DynamicViewProps {
    patientMeta?: PatientMeta,
    tableNames?: string[],
    tableRecords?: Entity<number, any>[],
    dynamicRecords: RecordTS[],
    itemDicts?: ItemDict
}

export interface DynamicViewStates {
    targetTableName?: string,
    targetItems?: string[],
}

export default class DynamicView extends React.Component<DynamicViewProps, DynamicViewStates> {

    constructor(props: DynamicViewProps) {
        super(props);

        this.state = {}
    }

    public render() {
        const { tableNames, patientMeta, dynamicRecords, itemDicts } = this.props;

        const startDate = patientMeta && new Date(patientMeta.startDate);
        const endDate = patientMeta && new Date(patientMeta.endDate);

        return (
            <div>
                <div>
                    <Search placeholder="input search text" style={{ marginLeft: 10, marginRight: 10, width: "90%" }} enterButton />
                </div>
                <div>
                    {dynamicRecords.map((data, i) =>
                        <DynamicCard
                            {...data}
                            key={i}
                            itemDicts={itemDicts}
                            startTime={startDate}
                            endTime={endDate}
                            align={false}
                            timeSeriesStyle={{
                                margin: { bottom: 20, left: 25, top: 15 }
                            }}
                        />)}
                </div>
            </div>
        )
    }
}

export interface TimeSeriesStyle {
    width: number,
    height: number,
    color: string,
    margin: MarginType,
}

const defaultTimeSeriesStyle: TimeSeriesStyle = {
    width: 720,
    height: 120,
    color: "#aaa",
    margin: defaultMargin,
}

export interface DynamicCardProps extends RecordTS {
    startTime?: Date,
    endTime?: Date,
    align?: boolean,
    timeSeriesStyle: Partial<TimeSeriesStyle>,
    itemDicts?: ItemDict
}

export interface DynamicCardStates { }

export class DynamicCard extends React.Component<DynamicCardProps, DynamicCardStates> {
    private ref: React.RefObject<SVGSVGElement> = React.createRef();

    constructor(props: DynamicCardProps) {
        super(props);

        this.paint = this.paint.bind(this);
    }

    componentDidMount() {
        this.paint();
    }

    componentDidUpdate(prevProps: DynamicCardProps) {
        if (prevProps !== this.props) {
            this.paint();
        }
    }

    private paint() {
        const { data, startTime, endTime } = this.props;
        const style = { ...defaultTimeSeriesStyle, ...this.props.timeSeriesStyle };
        const { width, height, color } = style;
        const margin = getMargin(style.margin);
        const extend: [Date, Date] | undefined = startTime && endTime && [startTime, endTime];
        const timeScale = getScaleTime(0, width - margin.left - margin.right,
            data.dates, extend);
        const node = this.ref.current;
        if (node) {
            drawLineChart({
                data: data,
                svg: node,
                width: width,
                height: height,
                margin: margin,
                color: color,
                // timeScale: timeScale,
            })
        }
    }

    public render() {
        const { tableName, itemName, itemDicts } = this.props;
        const style = { ...defaultTimeSeriesStyle, ...this.props.timeSeriesStyle };
        const { width, height } = style;
        const itemLabel = itemDicts && itemDicts(tableName, itemName)?.LABEL;

        // return <Card title={`${tableName}.${itemName}`} size="small">
        //     <svg ref={this.ref} className={"ts-svg"} style={{ width: width, height: height }} />
        // </Card>
        return <div className={"ts-card"}>
            <div className={"ts-title"}> 
                <span className={"ts-title-text"}>{`${itemLabel || itemName}`}</span>
                <Button size="small" type="text" icon={<CloseOutlined />} className={"ts-title-button"}/>
                <Button size="small" type="text" icon={<MinusOutlined />} className={"ts-title-button"}/>
                <Button size="small" type="text" icon={<PushpinOutlined />} className={"ts-title-button"}/>
                <Button size="small" type="primary" className={"ts-title-button"}>Explain</Button>
            </div>
            <svg ref={this.ref} className={"ts-svg"} style={{ width: width, height: height }} />
        </div>
    }
}
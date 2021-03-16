import { Button, Card, Divider, Select } from "antd";
import { PatientMeta } from "data/patient";
import { Entity, ItemDict } from "data/table";
import * as React from "react";
import { DataFrame, IDataFrame, ISeries } from "data-forge"
import { defaultMargin, getMargin, getScaleLinear, IMargin } from "visualization/common";
import Search from "antd/lib/input/Search";
import "./index.scss"
import { CloseOutlined, ExpandAltOutlined, PushpinOutlined, ShrinkOutlined } from "@ant-design/icons";
import { referenceValue } from "data/common";
import { getReferenceValues } from "router/api";
import LineChart from "visualization/lineChart";

export interface RecordTS {
    tableName: string,
    columnName: string,
    itemName: string,
    startTime?: Date,
    endTime?: Date,
    // data?: { dates: ISeries<number, Date>, values: ISeries<number, any> },
}

export interface DynamicViewProps {
    patientMeta: PatientMeta,
    itemDicts?: ItemDict,
    tableRecords: Entity<number, any>[],
    dynamicRecords: RecordTS[],
    subjectIdG?: number[],
}

export interface DynamicViewStates {}

export default class DynamicView extends React.Component<DynamicViewProps, DynamicViewStates> {

    constructor(props: DynamicViewProps) {
        super(props);

        this.state = {};
    }

    private extractData(record: RecordTS) {
        const { tableName, columnName, itemName, startTime, endTime } = record;
        const { tableRecords } = this.props;
        const entity = tableRecords.find(e => e.name === tableName);
        const { item_index, time_index } = entity!.metaInfo!;
        let entries = entity!.where(row => row[item_index!] === itemName);
        if (startTime) entries = entries?.where(row => startTime < new Date(row[time_index!]));
        if (endTime) entries = entries?.where(row => new Date(row[time_index!]) < endTime);
        return {dates: entries?.getSeries(time_index!).parseDates(), values: entries?.getSeries(columnName!).parseFloats()}
    }

    public render() {
        const { patientMeta, dynamicRecords, itemDicts, subjectIdG } = this.props;

        const startDate = patientMeta && new Date(patientMeta.startDate);
        const endDate = patientMeta && new Date(patientMeta.endDate);

        return (
            <div>
                <div>
                    {/* <Search placeholder="input search text" style={{ marginLeft: 10, marginRight: 10, width: "90%" }} enterButton /> */}
                </div>
                <Divider />
                <div>
                    {dynamicRecords.map((records, i) =>
                        <DynamicCard
                            {...records}
                            data={this.extractData(records)}
                            key={i}
                            itemDicts={itemDicts}
                            startTime={startDate}
                            endTime={endDate}
                            align={false}
                            subjectIdG={subjectIdG}
                            timeSeriesStyle={{
                                margin: { bottom: 20, left: 25, top: 15, right: 25 }
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
    margin: IMargin,
}

const defaultTimeSeriesStyle: TimeSeriesStyle = {
    width: 720,
    height: 120,
    color: "#aaa",
    margin: defaultMargin,
}

export interface DynamicCardProps extends RecordTS {
    data: { dates: ISeries<number, Date>, values: ISeries<number, any> },
    align?: boolean,
    timeSeriesStyle: Partial<TimeSeriesStyle>,
    itemDicts?: ItemDict,
    subjectIdG?:number[],
}

export interface DynamicCardStates {
    expand: boolean,
    referenceValue?: referenceValue
}

export class DynamicCard extends React.Component<DynamicCardProps, DynamicCardStates> {

    constructor(props: DynamicCardProps) {
        super(props);
        this.state = {
            expand: false,
        };

        this.onExpand = this.onExpand.bind(this);
        this.onCollapse = this.onCollapse.bind(this);
    }

    componentDidMount() {
        this.loadReferenceValues();
    }
    componentDidUpdate(prevProps: DynamicCardProps, prevState: DynamicCardStates) {
        if (prevProps.subjectIdG?.sort().toString() !== this.props.subjectIdG?.sort().toString()){
            this.loadReferenceValues()
        }
    }

    private async loadReferenceValues() {
        const { tableName, columnName, itemName } = this.props;
        const valueFn = await getReferenceValues({
            table_name: tableName,
            column_name: columnName
        });
        const referenceValue = valueFn(itemName);
        this.setState({ referenceValue });
        // console.log('loadReferenceValues', this.state.referenceValue)
    }

    private onExpand() {
        this.setState({ expand: true });
    }
    private onCollapse() {
        this.setState({ expand: false });
    }

    public render() {
        const { tableName, itemName, itemDicts, data } = this.props;
        const { expand, referenceValue } = this.state;
        const style = { ...defaultTimeSeriesStyle, ...this.props.timeSeriesStyle };
        const { width, height, color } = style;
        const margin = getMargin(style.margin);
        const itemLabel = itemDicts && itemDicts(tableName, itemName)?.LABEL;

        return <div className={"ts-card"}>
            <div className={"ts-title-float"} style={{ width: width }}>
                <span className={"ts-title-float-text"}>{`${itemLabel || itemName}`}</span>
                <Button size="small" type="primary" icon={<CloseOutlined />} className={"ts-title-button"}/>
                {expand ? <Button size="small" type="primary" icon={<ShrinkOutlined />} className={"ts-title-button"} onClick={this.onCollapse} />
                    : <Button size="small" type="primary" icon={<ExpandAltOutlined />} className={"ts-title-button"} onClick={this.onExpand} />}
                <Button size="small" type="primary" icon={<PushpinOutlined />} className={"ts-title-button"} />
                {/* <Button size="small" type="primary" className={"ts-title-button"}>Explain</Button> */}
            </div>
            <LineChart
                data={data}
                referenceValue={referenceValue}
                height={expand ? height : 30}
                width={width}
                margin={expand ? margin : { ...margin, top: 20, bottom: 10 }}
                color={color}
                yScale={expand ? undefined : getScaleLinear(0, 0, undefined, [-1, 1])}
                drawXAxis={expand}
                drawYAxis={expand}
                drawReferences={expand && referenceValue!=undefined}
            />
        </div>
    }
}
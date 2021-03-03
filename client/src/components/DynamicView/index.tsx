import { Card, Select } from "antd";
import { distinct } from "data/common";
import { PatientMeta } from "data/patient";
import { Entity } from "data/table";
import * as React from "react";
import { DataFrame, ISeries } from "data-forge"
import { defaultMargin, getMargin, getScaleTime, MarginType } from "visualization/common";
import { drawLineChart } from "visualization/lineChart";
import Search from "antd/lib/input/Search";

const { Option } = Select;

export interface RecordTS {
    tableName: string,
    itemName: string,
    startTime?: Date,
    endTime?: Date,
    data: { dates: ISeries<number, Date>, values: ISeries<number, any> }
}

// const buildRecordTS = (entity: Entity<number, any>, itemName: string): RecordTS[] => {
//     const { item_index, time_index, value_indexes } = entity.metaInfo!;
//     if (item_index && time_index && value_indexes && value_indexes.length > 0) {
//         const selectedDf = entity.where(row => (row[item_index] === itemName));
//         const dates = selectedDf.getSeries(time_index).parseDates();
//         const records = value_indexes.map(value_index => {
//             return {
//                 tableName: entity.name!,
//                 itemName: itemName,
//                 data: { dates: dates, values: selectedDf.getSeries(value_index).parseFloats() }
//             }
//         })
//         return records;
//     }
//     else
//         return [];
// }

export interface DynamicViewProps {
    patientMeta?: PatientMeta,
    tableNames?: string[],
    tableRecords?: Entity<number, any>[],
    dynamicRecords: RecordTS[],
}

export interface DynamicViewStates {
    targetTableName?: string,
    itemOptions?: string[],
    targetItems?: string[],
}

export default class DynamicView extends React.Component<DynamicViewProps, DynamicViewStates> {

    constructor(props: DynamicViewProps) {
        super(props);

        this.state = { }

        this._setTableName = this._setTableName.bind(this);
        // this._setItemName = this._setItemName.bind(this);
    }

    _setTableName(value: string) {
        const { tableRecords } = this.props
        const targetTable = tableRecords?.find(e => e.name === value);
        const itemIndex = targetTable?.metaInfo?.item_index;
        let itemOptions: undefined | string[] = [];
        if (itemIndex) {
            itemOptions = targetTable?.getSeries(itemIndex).toArray().filter(distinct);
        }
        this.setState({ targetTableName: value, itemOptions: itemOptions });
    }

    // _setItemName(value: string) {
    //     const { tableRecords } = this.props;
    //     const { itemOptions, targetTableName } = this.state;
    //     const targetTable = tableRecords?.find(e => e.name === targetTableName)!;
    //     const targetItems = value === 'All' ? itemOptions : [value];
    //     const recordList = targetItems!.map(itemName => buildRecordTS(targetTable, itemName));
    //     const recordData = Array.prototype.concat.apply([], recordList);
    //     this.setState({ targetItems, recordData });
    // }

    public render() {
        const { tableNames, patientMeta, dynamicRecords } = this.props;
        const { itemOptions } = this.state;

        const startDate = patientMeta && new Date(patientMeta.startDate);
        const endDate = patientMeta && new Date(patientMeta.endDate);
        console.log(dynamicRecords);

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
                            startTime={startDate}
                            endTime={endDate}
                            align={false}
                            timeSeriesStyle={{
                                margin: {bottom: 20, left: 25, top: 15}
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
    width: 560,
    height: 120,
    color: "#aaa",
    margin: defaultMargin,
}

export interface DynamicCardProps extends RecordTS {
    startTime?: Date,
    endTime?: Date,
    align?: boolean,
    timeSeriesStyle: Partial<TimeSeriesStyle>
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
        const { tableName, itemName } = this.props;
        const style = { ...defaultTimeSeriesStyle, ...this.props.timeSeriesStyle };
        const { width, height } = style;

        return <Card title={`${tableName}.${itemName}`} size="small">
            <svg ref={this.ref} className={"ts-svg"} style={{ width: width, height: height }} />
        </Card>
    }
}
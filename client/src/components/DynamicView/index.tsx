import { Button, Card, Divider, Select, Spin } from "antd";
import { PatientMeta } from "data/patient";
import { Entity, ItemDict } from "data/table";
import * as React from "react";
import * as _ from "lodash"
import { DataFrame, IDataFrame, ISeries } from "data-forge";
import { defaultMargin, getMargin, getScaleLinear, getScaleTime, IMargin } from "visualization/common";
import { CloseOutlined, ExpandAltOutlined, PushpinOutlined, ShrinkOutlined } from "@ant-design/icons";
import { arrayShallowCompare, ReferenceValue, ReferenceValueDict, timeDeltaPrinter } from "data/common";
import { getSegmentExplanation } from "router/api";
import LineChart from "visualization/lineChart";

import "./index.scss";
import { FeatureMeta } from "data/feature";
import { SegmentExplanation } from "data/event";

export interface SignalMeta {
    tableName: string,
    columnName: string,
    itemName: string,
    startTime: Date,
    endTime: Date,
    relatedFeatureNames: string[]
    featurePeriods?: (name: string) => [Date, Date]
}

export interface Signal extends SignalMeta {
    data?: { dates: ISeries<number, Date>, values: ISeries<number, number> }
}

export interface DynamicViewProps {
    className: string,
    patientMeta: PatientMeta,
    featureMeta: IDataFrame<number, FeatureMeta>,
    itemDicts?: ItemDict,
    tableRecords: Entity<number, any>[],
    signalMetas: SignalMeta[],
    align?: boolean,
    width: number,
    color?: (entityName: string) => string,
    updateFocusedFeatures?: (featureNames: string[]) => void,
    updatePinnedFocusedFeatures?: (featureNames: string[]) => void,
    pinSignal: (signalMeta: SignalMeta) => void;
    removeSignal: (signalMeta: SignalMeta) => void;
    referenceValues?: (tableName: string) => ReferenceValueDict | undefined;
}

export interface DynamicViewStates {
    signalGroups: IDataFrame<number, Signal>[],
    globalStartTime?: Date,
    globalEndTime?: Date,
}

export default class DynamicView extends React.PureComponent<DynamicViewProps, DynamicViewStates> {

    constructor(props: DynamicViewProps) {
        super(props);
        this.state = {
            signalGroups: []
        };

        this.onPin = this.onPin.bind(this);
    }
    componentDidMount() {
        this.initSignals();
    }

    componentDidUpdate(prevProps: DynamicViewProps) {
        if (!arrayShallowCompare(prevProps.signalMetas, this.props.signalMetas)) {
            this.initSignals();
        }
    }

    private initSignals() {
        const signals = this.props.signalMetas
            .map(s => this.buildSignal(s))
            .filter(s => s.data && s.data.values.count());
        const signalGroups = new DataFrame(signals).groupBy(row => row.tableName).toArray();
        const globalStartTime = _.min(signals.map(s => _.min(s.data?.dates.toArray())));
        const globalEndTime = _.max(signals.map(s => _.max(s.data?.dates.toArray())));
        this.setState({ signalGroups, globalStartTime, globalEndTime });
    }

    private buildSignal(record: SignalMeta): Signal {
        const { tableName, columnName, itemName, startTime, endTime } = record;
        const { tableRecords } = this.props;
        const entity = tableRecords.find(e => e.name === tableName);
        const { item_index, time_index } = entity!.metaInfo!;
        let entries = entity!.where(row => row[item_index!] === itemName);
        if (startTime) entries = entries.where(row => startTime <= new Date(row[time_index!]));
        if (endTime) entries = entries.where(row => new Date(row[time_index!]) <= endTime);
        return {
            ...record,
            data: {
                dates: entries.getSeries(time_index!).parseDates(),
                values: entries.getSeries(columnName!).parseFloats()
            }
        }
    }

    private onPin(signal: SignalMeta) {
        const { updatePinnedFocusedFeatures, pinSignal } = this.props;
        updatePinnedFocusedFeatures && updatePinnedFocusedFeatures(signal.relatedFeatureNames);
        pinSignal && pinSignal(signal);
    }

    public render() {
        const { patientMeta, itemDicts, color, updateFocusedFeatures, removeSignal, className, referenceValues, align, width } = this.props;
        const { signalGroups, globalStartTime, globalEndTime } = this.state;
        const margin = { bottom: 20, left: 30, top: 15, right: 30 };
        let xScale: d3.ScaleTime<number, number> | undefined = undefined;
        if (align && globalStartTime && globalEndTime) {
            const paddingTime = (globalEndTime.getTime() - globalStartTime.getTime()) * 0.05;
            const paddedStartTime = new Date(globalStartTime.getTime() - paddingTime);
            const paddedEndTime = new Date(globalEndTime.getTime() + paddingTime);
            xScale = getScaleTime(0, width - margin.left - margin.right, undefined, [paddedStartTime, paddedEndTime])
        }
        return (
            <div>
                <div>
                    {signalGroups.map(group => <div key={group.first().tableName}>
                        <Divider>{group.first().tableName}</Divider>
                        {group.toArray().map((signal, i) =>
                            <DynamicCard
                                className={className}
                                patientMeta={patientMeta}
                                signal={signal}
                                referenceValues={referenceValues && referenceValues(signal.tableName)}
                                key={signal.itemName}
                                itemDicts={itemDicts}
                                align={true}
                                xScale={xScale}
                                width={width}
                                margin={margin}
                                color={color && color(signal.tableName)}
                                // onHover={updateFocusedFeatures && (() => updateFocusedFeatures(signal.relatedFeatureNames))}
                                // onLeave={updateFocusedFeatures && (() => updateFocusedFeatures([]))}
                                onRemove={removeSignal && (() => removeSignal(signal))}
                                onPin={() => this.onPin(signal)}
                            />)}
                    </div>
                    )}
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

export interface DynamicCardProps extends Partial<TimeSeriesStyle> {
    signal: Signal,
    patientMeta: PatientMeta,
    className: string,
    align?: boolean,
    // timeSeriesStyle: Partial<TimeSeriesStyle>,
    xScale?: d3.ScaleTime<number, number>,
    itemDicts?: ItemDict,
    updateFocusedFeatures?: (featureNames: string[]) => void,
    updatePinnedFocusedFeatures?: (featureName: string) => void,
    onHover?: () => void;
    onLeave?: () => void;
    onPin?: () => void;
    onRemove?: () => void;
    // subjectIdG?: number[],
    referenceValues?: ReferenceValueDict;
}

export interface DynamicCardStates {
    expand: boolean,
    pinned: boolean,
    explain: boolean,
    loading: boolean,
    segmentExplanation?: SegmentExplanation[]
}

export class DynamicCard extends React.Component<DynamicCardProps, DynamicCardStates> {

    constructor(props: DynamicCardProps) {
        super(props);
        this.state = {
            expand: false,
            pinned: false,
            explain: false,
            loading: false,
        };
        this.loadSegmentExplanation = this.loadSegmentExplanation.bind(this);

        this.onExpand = this.onExpand.bind(this);
        this.onCollapse = this.onCollapse.bind(this);
        this.onPin = this.onPin.bind(this);
        this.onExplain = this.onExplain.bind(this);
    }

    componentDidMount() {
    }
    componentDidUpdate(prevProps: DynamicCardProps, prevState: DynamicCardStates) {
    }

    private async loadSegmentExplanation() {
        this.setState({ loading: true });
        const { signal, patientMeta } = this.props;
        const { itemName, tableName } = signal;
        if (tableName === 'SURGERY_VITAL_SIGNS') {
            const segmentExplanation = await getSegmentExplanation({ subject_id: patientMeta.subjectId, item_id: itemName });
            this.setState({ segmentExplanation, loading: false });
        }
        this.setState({ loading: false });
    }

    private onExpand() {
        this.setState({ expand: true });
    }
    private onCollapse() {
        this.setState({ expand: false });
    }

    private onPin() {
        const { onPin } = this.props;
        onPin && onPin();
        this.setState({ pinned: !this.state.pinned });
    }

    public onExplain() {
        const { explain, segmentExplanation } = this.state;
        if (explain) this.setState({ explain: false })
        else {
            if (!segmentExplanation)
                this.loadSegmentExplanation();
            this.setState({ explain: true });
        }
    }

    public render() {
        const { className, signal, itemDicts, width, height, color, margin, xScale, referenceValues, onHover, onLeave, onRemove } =
            { ...defaultTimeSeriesStyle, ...this.props };
        const { expand, pinned, segmentExplanation, explain } = this.state;
        const { tableName, itemName, data, startTime, endTime } = signal;

        const itemLabel = itemDicts && itemDicts(tableName, itemName)?.LABEL;

        console.log('DynamicView', margin, height);

        return <div className={"ts-card"} id={`${className}-${signal.itemName}`}
            style={{ borderLeftColor: color || '#aaa', borderLeftWidth: 4 }}
            onMouseOver={onHover} onMouseOut={onLeave}>
            <Spin spinning={this.state.loading} delay={500}>
                {data && <LineChart
                    data={data}
                    referenceValue={referenceValues && referenceValues(itemName)}
                    segments={explain ? segmentExplanation && _.flatten(segmentExplanation.map(d => d.segments)) : []}
                    height={expand ? height : 30}
                    width={width}
                    xScale={xScale}
                    margin={expand ? margin : { ...margin, top: 4, bottom: 0}}
                    color={color}
                    expand={expand}
                    yScale={expand ? undefined : getScaleLinear(15, 15, undefined, [-1, 1])}
                    drawXAxis={expand}
                    drawYAxis={expand}
                    drawDots={expand}
                    drawAnnotations={!expand}
                    drawReferences={expand && referenceValues != undefined}
                />}
            </Spin>
            <div className={"ts-title-float"} style={{ width: width }}>
                {/* <span className={"ts-title-float-text"}>{`${itemLabel || itemName} (${timeDeltaPrinter(startTime, endTime)})`}</span> */}
                <span className={"ts-title-float-text"}>{`${itemLabel || itemName}`}</span>

                <Button size="small" type="primary" shape="circle" icon={<PushpinOutlined />} className={"ts-title-button"}
                    style={{ display: pinned ? 'block' : undefined }} onClick={this.onPin}
                />
                <Button size="small" type="primary" shape="circle" icon={<CloseOutlined />} className={"ts-title-button"}
                    onClick={onRemove} />
                {expand ? <Button size="small" type="primary" shape="circle" icon={<ShrinkOutlined />} className={"ts-title-button"} onClick={this.onCollapse} />
                    : <Button size="small" type="primary" shape="circle" icon={<ExpandAltOutlined />} className={"ts-title-button"} onClick={this.onExpand} />}
                <Button size="small" type="primary" shape="circle" className={"ts-title-button"} onClick={this.onExplain}>E</Button>
            </div>
        </div>
    }
}
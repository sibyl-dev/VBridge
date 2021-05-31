import { Button, Card, Divider, Select, Spin } from "antd";
import { PatientStatics } from "type/patient";
import { Entity, ItemDict, ReferenceValueResponse, ReferenceValues, StatValues } from "type/entity";
import * as React from "react";
import * as _ from "lodash"
import { DataFrame, IDataFrame, ISeries } from "data-forge";
import { defaultMargin, getMargin, getScaleLinear, getScaleTime, IMargin } from "visualization/common";
import { CloseOutlined, ExpandAltOutlined, PushpinOutlined, ShrinkOutlined } from "@ant-design/icons";
import { arrayShallowCompare } from "utils/common";
import API from "router/api";
import LineChart from "visualization/lineChart";

import "./index.scss";
import { FeatureSchema } from "type/feature";
import { SignalExplanation } from "type/explanation";

export interface SignalMeta {
    entityId: string,
    columnId: string,
    itemId: string,
    startTime: Date,
    endTime: Date,
    relatedFeatureNames: string[],
    statValues?: StatValues,
    featurePeriods?: (name: string) => [Date, Date]
}

export interface Signal extends SignalMeta {
    data?: { dates: ISeries<number, Date>, values: ISeries<number, number> }
}

export interface DynamicViewProps {
    className: string,
    patientStatics: PatientStatics,
    patientTemporals: Entity<number, any>[],
    signalMetas: SignalMeta[],
    featureSchemas: IDataFrame<number, FeatureSchema>,
    align?: boolean,
    width: number,
    color?: (entityName: string) => string,
    updateFocusedFeatures?: (featureNames: string[]) => void,
    updatePinnedFocusedFeatures?: (featureNames: string[]) => void,
    pinSignal: (signalMeta: SignalMeta) => void;
    removeSignal: (signalMeta: SignalMeta) => void;
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
        this.tableNamesChange = this.tableNamesChange.bind(this);
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
        const signalGroups = new DataFrame(signals).groupBy(row => row.entityId).toArray();
        const globalStartTime = _.min(signals.map(s => _.min(s.data?.dates.toArray())));
        const globalEndTime = _.max(signals.map(s => _.max(s.data?.dates.toArray())));
        this.setState({ signalGroups, globalStartTime, globalEndTime });
    }

    private buildSignal(record: SignalMeta): Signal {
        const { entityId: tableName, columnId: columnName, itemId: itemName, startTime, endTime } = record;
        const { patientTemporals: tableRecords } = this.props;
        const entity = tableRecords.find(e => e.id === tableName);
        const { item_index, time_index } = entity!.schema!;
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

    private tableNamesChange(name: string){
        if(name == 'LABEVENTS')
          return 'Lab Tests'
        if(name == 'SURGERY_VITAL_SIGNS')
          return 'Vital Signs'
        if(name == 'CHARTEVENTS')
          return 'Chart Events'
        return 'Prescriptions'
    
      }

    private onPin(signal: SignalMeta) {
        const { updatePinnedFocusedFeatures, pinSignal } = this.props;
        updatePinnedFocusedFeatures && updatePinnedFocusedFeatures(signal.relatedFeatureNames);
        pinSignal && pinSignal(signal);
    }

    public render() {
        const { patientStatics: patientMeta, color, updateFocusedFeatures, removeSignal, className, align, width } = this.props;
        const { signalGroups, globalStartTime, globalEndTime } = this.state;
        const margin = { bottom: 20, left: 30, top: 15, right: 10 };
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
                    {signalGroups.map(group => <div key={group.first().entityId}>
                        <Divider style={{margin: 8}}>{this.tableNamesChange(group.first().entityId)}</Divider>
                        {group.toArray().map((signal, i) =>
                            <DynamicCard
                                className={className}
                                patientStatics={patientMeta}
                                signal={signal}
                                key={signal.itemId}
                                align={true}
                                xScale={xScale}
                                width={width}
                                margin={margin}
                                color={color && color(signal.entityId)}
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
    patientStatics: PatientStatics,
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
}

export interface DynamicCardStates {
    expand: boolean,
    pinned: boolean,
    explain: boolean,
    loading: boolean,
    segmentExplanation?: SignalExplanation[]
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
        // this.loadSegmentExplanation = this.loadSegmentExplanation.bind(this);

        this.onExpand = this.onExpand.bind(this);
        this.onCollapse = this.onCollapse.bind(this);
        this.onPin = this.onPin.bind(this);
        this.onExplain = this.onExplain.bind(this);
    }

    // private async loadSegmentExplanation() {
    //     this.setState({ loading: true });
    //     const { signal, patientMeta } = this.props;
    //     const { itemName, tableName } = signal;
    //     if (tableName === 'SURGERY_VITAL_SIGNS') {
    //         const segmentExplanation = await API.signalExplanation.find({ subject_id: patientMeta.id, item_id: itemName });
    //         this.setState({ segmentExplanation, loading: false });
    //     }
    //     this.setState({ loading: false });
    // }

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
            // if (!segmentExplanation)
            //     this.loadSegmentExplanation();
            this.setState({ explain: true });
        }
    }

    public render() {
        const { className, signal, itemDicts, width, height, color, margin, xScale, onHover, onLeave, onRemove } =
            { ...defaultTimeSeriesStyle, ...this.props };
        const { expand, pinned, segmentExplanation, explain } = this.state;
        const { entityId, itemId, data, startTime, endTime, statValues } = signal;

        // const itemLabel = itemDicts && itemDicts(tableName, itemName)?.LABEL;

        console.log('DynamicView', margin, height);

        return <div className={"ts-card"} id={`${className}-${signal.itemId}`}
            style={{ borderLeftColor: color || '#aaa', borderLeftWidth: 4 }}
            onMouseOver={onHover} onMouseOut={onLeave}>
            <Spin spinning={this.state.loading} delay={500}>
                {data && <LineChart
                    data={data}
                    // segments={explain ? segmentExplanation && _.flatten(segmentExplanation.map(d => d.segments)) : []}
                    height={expand ? height : 32}
                    width={width}
                    xScale={xScale}
                    margin={expand ? margin : { ...margin, top: 4, bottom: 0}}
                    color={color}
                    expand={expand}
                    yScale={expand ? undefined : getScaleLinear(15, 15, undefined, [-1, 1])}
                    referenceValue={statValues}
                    drawXAxis={expand}
                    drawYAxis={expand}
                    drawDots={expand}
                    drawAnnotations={!expand}
                />}
            </Spin>
            <div className={"ts-title-float"} style={{ width: width }}>
                {/* <span className={"ts-title-float-text"}>{`${itemLabel || itemName} (${timeDeltaPrinter(startTime, endTime)})`}</span> */}
                <span className={"ts-title-float-text"}>{`${itemId}`}</span>

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
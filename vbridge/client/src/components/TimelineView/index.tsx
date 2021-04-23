import * as React from "react";
import * as d3 from "d3";
import * as _ from "lodash"
import { PatientMeta } from "data/patient";
import { Entity } from "data/table";
import { QUATER_IN_MILI, defaultCategoricalColor, getScaleTime, IMargin, calIntervalsByQuarter, getRefinedStartEndTime, getQuarter } from "visualization/common";
import { IEvent, IEventBin } from "data/event";
import { FeatureMeta } from "data/feature";
import { IDataFrame, ISeries } from "data-forge";
import { isDefined, ReferenceValueDict } from "data/common";

import "./index.scss"
import Timeline from "visualization/Timeline";

export interface TimelineViewProps {
    tableNames: string[],
    patientMeta: PatientMeta,
    featureMeta: IDataFrame<number, FeatureMeta>,
    tableRecords: Entity<number, any>[],
    onSelectEvents?: (entityName: string, startDate: Date, endDate: Date) => void,
    entityCategoricalColor?: (entityName?: string) => string,
    referenceValues?: (tableName: string) => ReferenceValueDict | undefined,
    width: number,
}

export interface TimelineViewStates {
    timeScale?: d3.ScaleTime<number, number>,
    eventBins?: IEventBin[][],
    intervalByQuarter?: number,
    startTime?: Date,
    endTime?: Date,
}

export default class TimelineView extends React.Component<TimelineViewProps, TimelineViewStates> {
    private ref: React.RefObject<HTMLDivElement> = React.createRef();
    private margin: IMargin = { left: 0, right: 0, top: 0, bottom: 0 };
    private titleWidth: number = 100;
    private rowHeight: number = 40;
    constructor(props: TimelineViewProps) {
        super(props);
        this.state = {};

        this._extractEvents = this._extractEvents.bind(this);
        this.color = this.color.bind(this);
    }

    public componentDidMount() {
        this.init();
    }

    public init() {
        const { patientMeta } = this.props
        let startDate = patientMeta.AdmitTime;
        let endDate = patientMeta.SurgeryEndTime;
        if (startDate && endDate) {
            const intervalByQuarter = calIntervalsByQuarter(startDate, endDate, 9, 16);
            const extent = getRefinedStartEndTime(startDate, endDate, intervalByQuarter);
            const timeScale = getScaleTime(0, this.ref.current!.offsetWidth - this.margin.left
                - this.margin.right - this.titleWidth, undefined, extent)
            this.setState({ startTime: extent[0], endTime: extent[1], timeScale: timeScale, intervalByQuarter },
                () => this._extractEvents());
        }
    }

    public componentDidUpdate(prevProps: TimelineViewProps, prevStates: TimelineViewStates) {
        if (prevProps.patientMeta !== this.props.patientMeta) {
            this.init()
        }
        if (prevStates.timeScale !== this.state.timeScale) {
            // this.calIntervals()
        }
    }

    private _extractEvents() {
        const { tableRecords, referenceValues } = this.props
        const { intervalByQuarter, startTime, endTime } = this.state

        if (tableRecords && intervalByQuarter && startTime) {
            const eventBins: IEventBin[][] = [];
            for (const entity of tableRecords) {
                const { timeIndex, name } = entity;
                const referenceValueDict = referenceValues && referenceValues(name!)

                const eventSeries: ISeries<number, IEvent> = entity.groupBy(row => row[timeIndex!]).select(group => {
                    const { item_index, value_indexes } = entity.metaInfo!;
                    const sample = group.first();
                    const items = _.uniq(group.getSeries(item_index!).toArray());
                    const abnormalItems: string[] = [];
                    let abnormalyCount = undefined;
                    if (referenceValueDict) {
                        abnormalyCount = group.where(row => {
                            const item = row[item_index!]
                            if (item_index && value_indexes && value_indexes.length > 0) {
                                const value_index = value_indexes[0];
                                const referenceValue = referenceValueDict(item);
                                if (referenceValue) {
                                    const outOfRange = (row[value_index] > referenceValue?.ci95[1]) ||
                                        (row[value_index] < referenceValue?.ci95[0]);
                                    if (outOfRange) {
                                        abnormalItems.push(item);
                                    }
                                    return outOfRange
                                }
                            }
                            return false
                        }).count()
                    }
                    return {
                        entityName: name!,
                        timestamp: new Date(sample[timeIndex!]),
                        count: group.count(),
                        abnormalyCount: abnormalyCount,
                        items: items,
                        abnormalItems: abnormalItems
                    }
                });

                const eventBinSeries: ISeries<number, IEventBin> = eventSeries
                    .groupBy(row => Math.floor(row.timestamp.getTime() / (QUATER_IN_MILI * intervalByQuarter)))
                    .select(group => {
                        const sample = group.first();
                        const binId = Math.floor((getQuarter(sample.timestamp) - getQuarter(startTime)) / intervalByQuarter);
                        const binStartTime = new Date(startTime.getTime() + binId * (QUATER_IN_MILI * intervalByQuarter));
                        const binEndTime = new Date(startTime.getTime() + (binId + 1) * (QUATER_IN_MILI * intervalByQuarter));
                        const groupArray = group.toArray();
                        const items: string[] = _.uniq(_.flatten(groupArray.map(d => d.items).filter(isDefined)));
                        const abnormalItems: string[] = _.uniq(_.flatten(groupArray.map(d => d.abnormalItems).filter(isDefined)));
                        return {
                            entityName: sample.entityName,
                            binStartTime, binEndTime, binId,
                            count: _.sum(groupArray.map(d => d.count)),
                            abnormalyCount: _.sum(groupArray.map(d => d.abnormalyCount).filter(isDefined)),
                            items: items,
                            abnormalItems: abnormalItems
                        }
                    });
                eventBins.push(eventBinSeries.toArray());
            }
            this.setState({ eventBins });
        }
    }

    private color(id: number) {
        const { entityCategoricalColor, tableRecords } = this.props;
        if (entityCategoricalColor && tableRecords) {
            return entityCategoricalColor(tableRecords[id].name);
        }
        else {
            return defaultCategoricalColor(id);
        }
    }

    public render() {
        const { tableRecords, onSelectEvents } = this.props;
        const { timeScale, eventBins, startTime, endTime, intervalByQuarter } = this.state;

        return (
            <div className="timeline-view-container" ref={this.ref}>
                {timeLineLegend()}
                {eventBins && eventBins.map((events, i) => {
                    const title = tableRecords[i].metaInfo?.alias;
                    return <div className={"timeline-container"} key={i}>
                        <div className={"timeline-title"}
                            style={{ height: this.rowHeight, width: this.titleWidth, borderLeftColor: this.color(i) }} key={title}>
                            <span className={"timeline-title-text"}>{title === 'Chart Signs' ? 'Chart Events' : title}</span>
                        </div>
                        <Timeline
                            events={events}
                            timeScale={timeScale}
                            width={this.ref.current!.offsetWidth - this.titleWidth}
                            margin={this.margin}
                            height={this.rowHeight}
                            style={{ position: 'absolute', 'left': this.titleWidth + 15 }}
                            onSelectEvents={(startDate: Date, endDate: Date) =>
                                onSelectEvents && onSelectEvents(tableRecords[i].name!, startDate, endDate)}
                        // intervalByQuarter={intervalByQuarter}
                        />
                    </div>
                })}
            </div>
        )
    }
}

const timeLineLegend = () => {
    return <div className='timeline-legend'>
        <div className="eventsNumber">
            <span> Less Records </span>
            <svg className="colorLegend" style={{ height: '16px', width: '150px' }}>
                <defs>
                    <linearGradient id="gradient">
                        <stop offset="0%" stop-color={d3.interpolateBlues(0.2)}></stop>
                        <stop offset="100%" stop-color={d3.interpolateBlues(0.5)}></stop>
                    </linearGradient>
                </defs>
                <rect height="20" width="150" style={{ fill: "url('#gradient')" }}></rect>
            </svg>
            <span> More Records </span>
        </div>
        <div className="abnormal">
            <span> Less Abnormal Items </span>
            <div className='legend-rect' style={{ backgroundColor: '#919191', height: '10px', width: '10px' }} />
            <div className='legend-rect' style={{ backgroundColor: '#919191', height: '12px', width: '12px' }} />
            <div className='legend-rect' style={{ backgroundColor: '#919191', height: '14px', width: '14px' }} />
            <span> More Abnormal Items </span>
        </div>
    </div>
}
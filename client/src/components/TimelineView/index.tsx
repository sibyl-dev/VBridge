import * as React from "react";
import * as d3 from "d3";
import * as _ from "lodash"
import { PatientMeta } from "data/patient";
import { Entity } from "data/table";
import { defaultCategoricalColor, getScaleTime, IMargin, calIntervalsByQuarter, getRefinedStartEndTime, getIdbyQuarter } from "visualization/common";
import { IEvent, IEventBin } from "data/event";
import { TimelineAxis } from "./TimelineAxis";
// import { Timeline } from "./Timeline";

import "./index.scss"
import { TimelineList } from "./TimelineList";
import { FeatureMeta } from "data/feature";
import { IDataFrame, ISeries } from "data-forge";
import { isDefined, ReferenceValueDict } from "data/common";

const QUATER_IN_MILI = 1000 * 60 * 15;
const HOUR_IN_QUATER = 4;
const IntervalBins = [1, 2, HOUR_IN_QUATER, HOUR_IN_QUATER * 2, HOUR_IN_QUATER * 4, HOUR_IN_QUATER * 8,
    HOUR_IN_QUATER * 12, HOUR_IN_QUATER * 24, HOUR_IN_QUATER * 48];


export interface TimelineViewProps {
    tableNames: string[],
    patientMeta?: PatientMeta,
    featureMeta: IDataFrame<number, FeatureMeta>,
    tableRecords: Entity<number, any>[],
    onSelectEvents?: (entityName: string, startDate: Date, endDate: Date) => void,
    entityCategoricalColor?: (entityName?: string) => string,
    referenceValues?: (tableName: string) => ReferenceValueDict | undefined,
    width: number,
}

export interface TimelineViewStates {
    timeScale?: d3.ScaleTime<number, number>,
    events?: IEvent[][],
    eventBins?: IEventBin[][],
    intervalByQuarter?: number,
    startDate?: Date,
    endDate?: Date,
}

export default class TimelineView extends React.Component<TimelineViewProps, TimelineViewStates> {
    private ref: React.RefObject<HTMLDivElement> = React.createRef();
    constructor(props: TimelineViewProps) {
        super(props);
        this.state = {};

        this._extractEvents = this._extractEvents.bind(this);
        this.updateTimeScale = this.updateTimeScale.bind(this);
        this.color = this.color.bind(this);
        // this.calculateNewTime = this.calculateNewTime.bind(this)
        // this.calIntervals = this.calIntervals.bind(this)
    }

    public componentDidMount() {
        this.init()
    }
    public init() {
        const { patientMeta } = this.props
        let startDate = patientMeta && patientMeta.AdmitTime;
        let endDate = patientMeta && patientMeta.SurgeryEndTime;
        if (startDate && endDate) {
            const intervalByQuarter = calIntervalsByQuarter(startDate, endDate, 9, 16, IntervalBins);
            const extent = getRefinedStartEndTime(startDate, endDate, intervalByQuarter);
            this.setState({ startDate: extent[0], endDate: extent[1], intervalByQuarter }, () => this._extractEvents());
            this._extractEvents();
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
        const { intervalByQuarter, startDate, endDate } = this.state

        if (tableRecords && intervalByQuarter && startDate) {
            // const events = tableRecords.map(entity => calculateTracks(groupEvents(entity, 24)));
            const events: IEvent[][] = [];
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
                                    const outOfRange = (row[value_index] > referenceValue?.ci95[1]) || (row[value_index] < referenceValue?.ci95[0]);
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
                        const binId = Math.floor(getIdbyQuarter(sample.timestamp.getTime() - startDate.getTime()) / intervalByQuarter);
                        const binStartTime = new Date(startDate.getTime() + binId * (QUATER_IN_MILI * intervalByQuarter));
                        const binEndTime = new Date(startDate.getTime() + (binId + 1) * (QUATER_IN_MILI * intervalByQuarter));
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
                events.push(eventSeries.toArray());
                eventBins.push(eventBinSeries.toArray());
            }
            this.setState({ events, eventBins });
        }
    }

    public updateTimeScale(scale: d3.ScaleTime<number, number>, startDate: Date, endDate: Date) {
        this.setState({ timeScale: scale, startDate, endDate })
        // this.setState({startDate, endDate})
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
        const { patientMeta, tableRecords, onSelectEvents, entityCategoricalColor, tableNames, width } = this.props;
        const { timeScale, events, eventBins, startDate, endDate, intervalByQuarter } = this.state;
        const margin: IMargin = { left: 15, right: 15, top: 0, bottom: 0 };
        const metaEvents = patientMeta ? [{
            name: 'Admit to Hospital',
            timestamp: patientMeta.AdmitTime
        }, {
            name: 'Surgery Begin',
            timestamp: patientMeta.SurgeryBeginTime
        }, {
            name: 'Surgery End',
            timestamp: patientMeta.SurgeryEndTime
        }] : undefined;

        return (
            <div style={{ height: "100%", width: "100%" }}>
                <div className='timeline-legend'>
                    <div className="abnormal">
                      <span> Less Abnormal Items </span>
                      <div className='legend-rect' style={{ backgroundColor: '#919191',height:'10px', width:'10px'}} />
                      <div className='legend-rect' style={{ backgroundColor: '#919191',height:'13px', width:'13px'}} />
                      <div className='legend-rect' style={{ backgroundColor: '#919191',height:'16px', width:'16px'}} />
                      <span> More Abnormal Items </span>
                    </div>
                    <div className="eventsNumber">
                      <span> Less Records </span>
                      <div className='colorLegend' style={{ backgroundColor: '#919191',height:'10px', width:'50px'}} />
                      <span> More Records </span>
                    </div>
                </div>
                {tableRecords && eventBins && startDate && endDate && <div ref={this.ref} className={"timeline-view-content"}>
                    <TimelineList
                        // metaEvents={metaEvents}
                        events={eventBins}
                        titles={tableRecords.map(t => t.metaInfo?.alias || t.metaInfo?.name)}
                        timeScale={timeScale || getScaleTime(0, width - margin.left - margin.right, undefined, [startDate, endDate])}
                        timelineStyle={{
                            width: width,
                            margin: margin
                        }}
                        onSelectEvents={(id: number, startDate: Date, endDate: Date) =>
                            onSelectEvents && onSelectEvents(tableRecords[id].name!, startDate, endDate)}
                        color={this.color}
                        margin={{ top: 0, bottom: 0, left: 0, right: 0 }}
                    />
                </div>}
                {/* {tableRecords && intervalByQuarter && startDate && endDate && <TimelineAxis
                    className="fix-on-bottom"
                    startTime={startDate}
                    endTime={endDate}
                    timelineStyle={{
                        width: width,
                        height: 60,
                        margin: { ...margin, bottom: 20, top: 0 }
                    }}
                    // formulateStartandEnd={this.formulateStartandEnd}
                    updateTimeScale={this.updateTimeScale}
                    events={events}
                    color={defaultCategoricalColor}
                    size={intervalByQuarter * 15}
                />} */}

            </div>
        )
    }
}
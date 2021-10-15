import * as React from "react";
import * as d3 from "d3";
import * as _ from "lodash"
import {
    QUATER_IN_MILI, getScaleTime, IMargin, calIntervalsByQuarter,
    getRefinedStartEndTime, getQuarter
} from "visualization/common";
import { Entity } from "type/entity";
import { IEvent, IEventBin } from "type/event";
import { FeatureSchema, PatientStatics, ReferenceValueResponse } from "type/resource";
import { IDataFrame, ISeries } from "data-forge";
import { isDefined } from "utils/common";

import "./index.scss"
import Timeline from "visualization/Timeline";
import { ColorManager } from "visualization/color";

export interface TimelineViewProps {
    tableNames: string[],
    featureSchema: FeatureSchema[],
    entities: Entity<string, any>[],
    onSelectEvents?: (entityName: string, startDate: Date, endDate: Date) => void,
    referenceValues?: ReferenceValueResponse,
    colorManager?: ColorManager,
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
    private margin: IMargin = { left: 15, right: 15, top: 0, bottom: 0 };
    private titleWidth: number = 100;
    private rowHeight: number = 40;
    constructor(props: TimelineViewProps) {
        super(props);
        this.state = {};

        this._extractEvents = this._extractEvents.bind(this);
    }

    public componentDidMount() {
        this.init();
    }

    public init() {
        const { entities } = this.props
        const recordTimes: Date[] = _.flatten(entities.map(entity => {
            const { time_index } = entity.schema;
            // const _recordTimes = entity.getSeries(time_index!).toArray();
            console.log(entity, entity.getColumnNames(), entity.getSeries(time_index!));
            const _recordTimes = entity.getSeries(time_index!).parseDates().toArray();
            return [_.min(_recordTimes), _.max(_recordTimes)]
        })).filter(isDefined);
        if (recordTimes.length > 0) {
            const earlest = _.min(recordTimes)!;
            const latest = _.max(recordTimes)!;
            const intervalByQuarter = calIntervalsByQuarter(earlest, latest, 9, 16);
            const extent = getRefinedStartEndTime(earlest, latest, intervalByQuarter);
            const timeScale = getScaleTime(0, this.ref.current!.offsetWidth - this.margin.left
                - this.margin.right - this.titleWidth, undefined, extent);
            this.setState({ startTime: extent[0], endTime: extent[1], timeScale: timeScale, intervalByQuarter },
                () => this._extractEvents());
        }
    }

    private _extractEvents() {
        const { entities, referenceValues } = this.props
        const { intervalByQuarter, startTime, endTime } = this.state

        if (entities && intervalByQuarter && startTime) {
            const eventBins: IEventBin[][] = [];
            for (const entity of entities) {
                const { time_index, entityId, value_indexes } = entity.schema;
                const referenceValueDict = referenceValues && referenceValues[entityId]

                const eventSeries: ISeries<number, IEvent> = entity.groupBy(row => row[time_index!]).select(group => {
                    const { item_index, value_indexes } = entity.schema;
                    const sample = group.first();
                    const items = _.uniq(group.getSeries(item_index!).toArray());
                    const abnormalItems: string[] = [];
                    let abnormalyCount = undefined;
                    if (referenceValueDict && value_indexes) {
                        abnormalyCount = group.where(row => {
                            const item = row[item_index!]
                            if (item_index) {
                                const value_index = value_indexes[0];
                                const StatValues = referenceValueDict && referenceValueDict[item][value_index];
                                if (StatValues) {
                                    const outOfRange = (row[value_index] > StatValues?.ci95[1]) ||
                                        (row[value_index] < StatValues?.ci95[0]);
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
                        entityName: entityId,
                        timestamp: new Date(sample[time_index!]),
                        count: group.count(),
                        abnormalyCount: abnormalyCount,
                        items: items,
                        abnormalItems: abnormalItems
                    }
                });

                const eventBinSeries: ISeries<number, IEventBin> = eventSeries
                    .groupBy(row => Math.floor(getQuarter(row.timestamp) / intervalByQuarter))
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

    public render() {
        const { entities, onSelectEvents, colorManager } = this.props;
        const { timeScale, eventBins, startTime, endTime, intervalByQuarter } = this.state;

        return (
            <div className="timeline-view-container" ref={this.ref}>
                {timeLineLegend()}
                {eventBins && eventBins.map((events, i) => {
                    const entity = entities[i];
                    const width = this.ref.current!.offsetWidth;
                    return <div className={"timeline-container"} key={i}>
                        <div className={"timeline-title"}
                            style={{
                                height: this.rowHeight, width: this.titleWidth, 
                                borderLeftColor: colorManager?.entityColor(entity.id),
                                marginTop: i === 0 ? 20 : 0
                            }} key={entity.id}>
                            <span className={"timeline-title-text"}>{entity.schema.alias}</span>
                        </div>
                        <Timeline
                            events={events}
                            timeScale={timeScale}
                            width={width - this.titleWidth}
                            margin={this.margin}
                            height={this.rowHeight + (i === 0 ? 20 : 0)}
                            style={{ position: 'absolute', 'left': this.titleWidth + 15 }}
                            onSelectEvents={(startDate: Date, endDate: Date) =>
                                onSelectEvents && onSelectEvents(entity.id!, startDate, endDate)}
                            binTime={intervalByQuarter! * QUATER_IN_MILI}
                            drawTicks={i === 0}
                        />
                    </div>
                })}
            </div>
        )
    }
}

const timeLineLegend = () => {
    return <div className='timeline-legend'>
        <div className="event-number-legend">
            <span> Less Records </span>
            <svg className="color-legend" style={{ height: '16px', width: '150px' }}>
                <defs>
                    <linearGradient id="gradient">
                        <stop offset="0%" stopColor={d3.interpolateBlues(0.2)}></stop>
                        <stop offset="100%" stopColor={d3.interpolateBlues(0.5)}></stop>
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
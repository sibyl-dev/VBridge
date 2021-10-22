import * as React from "react";
import * as d3 from "d3";
import * as _ from "lodash"
import {
    QUATER_IN_MILI, getScaleTime, IMargin, calIntervalsByQuarter,
    getRefinedStartEndTime
} from "visualization/common";
import { Entity } from "type/entity";
import { IEventBin, groupCoinEvents, binEvents } from "type/event";
import { FeatureSchema, ReferenceValueResponse } from "type/resource";
import { isDefined } from "utils/common";
import { ColorManager } from "visualization/color";
import Timeline from "./Timeline";

import "./index.scss"

export interface TimelineViewProps {
    tableNames: string[],
    featureSchema: FeatureSchema[],
    entities: Entity<string, any>[],
    onSelectEvents?: (entityName: string, startDate: Date, endDate: Date) => void,
    referenceValues?: ReferenceValueResponse,
    colorManager?: ColorManager,
}

export interface TimelineViewStates {
    eventBins?: IEventBin[][],
    interval: number,
    extent: [Date, Date]
}

export default class TimelineView extends React.Component<TimelineViewProps, TimelineViewStates> {
    private ref: React.RefObject<HTMLDivElement> = React.createRef();
    private margin: IMargin = { left: 15, right: 15, top: 0, bottom: 0 };
    private titleWidth: number = 100;
    private rowHeight: number = 40;
    constructor(props: TimelineViewProps) {
        super(props);

        this.state = { ...this.getTimeScale(props.entities) };

        this.extractEvents = this.extractEvents.bind(this);
        this.getTimeScale = this.getTimeScale.bind(this);
    }

    public componentDidMount() {
        this.updateTimeScale();
        this.extractEvents();
    }

    public componentDidUpdate(prevProps: TimelineViewProps) {
        if (prevProps.entities !== this.props.entities) {
            this.updateTimeScale();
        }
        if (prevProps.referenceValues !== this.props.referenceValues) {
            this.extractEvents();
        }
    }

    private getTimeScale(entities: Entity<string, any>[]) {
        const recordTimes: Date[] = _.flatten(entities.map(entity => {
            const { time_index } = entity.schema;
            const _recordTimes = entity.getSeries(time_index!).parseDates().toArray();
            return [_.min(_recordTimes), _.max(_recordTimes)]
        })).filter(isDefined);

        const earlest = _.min(recordTimes)!;
        const latest = _.max(recordTimes)!;
        const interval = calIntervalsByQuarter(earlest, latest, 9, 16);
        const extent = getRefinedStartEndTime(earlest, latest, interval);
        return { extent, interval };
    }

    private updateTimeScale() {
        const { entities } = this.props;
        const { extent, interval } = this.getTimeScale(entities);
        this.setState({ extent, interval });
    }

    private extractEvents() {
        const { entities, referenceValues } = this.props
        const { interval, extent } = this.state

        const eventBins: IEventBin[][] = [];
        for (const entity of entities) {
            const refVal = referenceValues && referenceValues[entity.id];
            const eventGroups = groupCoinEvents(entity, refVal);
            const eventBin = interval && extent && binEvents(eventGroups, interval, extent[0]);
            if (eventBin) {
                eventBins.push(eventBin.toArray());
            }
        }
        this.setState({ eventBins });
    }

    public render() {
        const { entities, onSelectEvents, colorManager } = this.props;
        const { eventBins, interval, extent } = this.state;

        return (
            <div className="timeline-view-container" ref={this.ref}>
                {timeLineLegend()}
                {eventBins && eventBins.map((events, i) => {
                    const entity = entities[i];
                    const width = this.ref.current!.offsetWidth;
                    const timeScale = getScaleTime(0, width - this.margin.left
                        - this.margin.right - this.titleWidth, undefined, extent);
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
                            binTime={interval! * QUATER_IN_MILI}
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

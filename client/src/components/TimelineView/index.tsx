import * as React from "react";
import * as d3 from "d3";
import * as _ from "lodash"
import { PatientMeta } from "data/patient";
import { Entity } from "data/table";
import { defaultCategoricalColor, getScaleTime, IMargin } from "visualization/common";
import { IEvent } from "data/event";
import { TimelineAxis } from "./TimelineAxis";
import { Timeline } from "./Timeline";

import "./index.css"
import { TimelineList } from "./TimelineList";

export interface TimelineViewProps {
    patientMeta?: PatientMeta,
    tableRecords?: Entity<number, any>[],
    onSelectEvents?: (entityName: string, startDate: Date, endDate: Date) => void,
}

export interface TimelineViewStates {
    timeScale?: d3.ScaleTime<number, number>,
    // events?: VEventGroup[][],
    events?: IEvent[][],
}

export default class TimelineView extends React.Component<TimelineViewProps, TimelineViewStates> {
    private ref: React.RefObject<HTMLDivElement> = React.createRef();
    constructor(props: TimelineViewProps) {
        super(props);
        this.state = {};

        this.updateTimeScale = this.updateTimeScale.bind(this);
    }

    public componentDidMount() {
        this._extractEvents();
    }

    public componentDidUpdate(prevProps: TimelineViewProps) {
        if (prevProps.patientMeta !== this.props.patientMeta) {
            this._extractEvents();
            this.setState({ timeScale: undefined });
        }
    }

    private _extractEvents() {
        const { tableRecords } = this.props
        if (tableRecords) {
            // const events = tableRecords.map(entity => calculateTracks(groupEvents(entity, 24)));
            const events: IEvent[][] = [];
            for (const entity of tableRecords) {
                const { timeIndex, name } = entity;
                const groupedEntity = entity.groupBy(row => row[entity.timeIndex!]);
                const e: IEvent[] = groupedEntity.toArray().map(group => ({
                    entityName: name!,
                    timestamp: new Date(group.first()[timeIndex!]),
                    count: group.count()
                }))
                events.push(e);
            }

            this.setState({ events })
        }
    }

    public updateTimeScale(scale: d3.ScaleTime<number, number>) {
        this.setState({ timeScale: scale });
    }

    public render() {
        const { patientMeta, tableRecords, onSelectEvents } = this.props;
        let { timeScale, events } = this.state;
        const startDate = patientMeta && patientMeta.startDate;
        const endDate = patientMeta && patientMeta.endDate;
        const width = 700;
        const margin: IMargin = { left: 15, right: 15, top: 15, bottom: 0 }
        if (!timeScale) {
            const extent: [Date, Date] | undefined = startDate && endDate && [startDate, endDate];
            timeScale = extent && getScaleTime(0, width - margin.left - margin.right, undefined, extent);
        }

        return (
            <div style={{ height: "100%", width: "100%" }}>
                {tableRecords && events && <div ref={this.ref} className={"timeline-view-content"}>
                    <TimelineList
                        events={events}
                        titles={tableRecords.map(t => t.metaInfo?.alias || t.metaInfo?.name)}
                        timeScale={timeScale}
                        timelineStyle={{
                            width: width,
                            margin: margin
                        }}
                        onSelectEvents={(id: number, startDate: Date, endDate: Date) =>
                            onSelectEvents && onSelectEvents(tableRecords[id].name!, startDate, endDate)}
                        color={defaultCategoricalColor}
                        margin={{top: 0, bottom: 0, left: 0, right: 0}}
                    />
                </div>}
                {tableRecords && <TimelineAxis
                    className="fix-on-bottom"
                    startTime={startDate}
                    endTime={endDate}
                    timelineStyle={{
                        width: width,
                        height: 60,
                        margin: { ...margin, bottom: 20, top: 0 }
                    }}
                    updateTimeScale={this.updateTimeScale}
                    events={events}
                    color={defaultCategoricalColor}
                />}

            </div>
        )
    }
}
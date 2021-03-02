import * as React from "react";
import { PatientMeta } from "data/patient";
import { Entity } from "data/table";
import { defaultCategoricalColor, defaultMargin, getMargin, getScaleTime, IMargin, MarginType } from "visualization/common";
import { drawTimeline, drawTimelineAxis } from "visualization/timeline";
import Panel from "../Panel"
import "./index.css"
import { EventGroup, groupEvents } from "data/event";
import { calculateTracks, drawTimeline2, VEventGroup } from "visualization/timeline2";
import * as d3 from "d3";

export interface TimelineViewProps {
    patientMeta?: PatientMeta,
    tableRecords?: Entity<number, any>[]
}

export interface TimelineViewStates {
    timeScale?: d3.ScaleTime<number, number>,
    events?: VEventGroup[][],
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
        }
    }

    private _extractEvents() {
        const { tableRecords } = this.props
        if (tableRecords) {
            let events = tableRecords.map(entity => calculateTracks(groupEvents(entity, 24)));
            this.setState({ events })
        }
    }

    public updateTimeScale(scale: d3.ScaleTime<number, number>) {
        this.setState({ timeScale: scale });
    }

    public render() {
        const { patientMeta, tableRecords } = this.props;
        let { timeScale, events } = this.state;
        const startDate = patientMeta && new Date(patientMeta['startDate']);
        const endDate = patientMeta && new Date(patientMeta.endDate);
        const width = 600;
        const margin: IMargin = { left: 15, right: 15, top: 5, bottom: 5 }
        if (!timeScale) {
            const extent: [Date, Date] | undefined = startDate && endDate && [startDate, endDate];
            timeScale = extent && getScaleTime(0, width - margin.left - margin.right, undefined, extent);
        }

        return (
            <div>
                {tableRecords && <div ref={this.ref} className={"timeline-view-content"}>
                    {events?.map((e, i) =>
                    (<Timeline
                        events={e}
                        key={i}
                        title={tableRecords[i].metaInfo?.alias || tableRecords[i].metaInfo?.name}
                        timeScale={timeScale}
                        timelineStyle={{
                            color: defaultCategoricalColor(i),
                            width: width,
                            margin: margin
                        }}
                    />))}
                </div>}
                {tableRecords && <TimelineAxis
                    className="fix-on-bottom"
                    startTime={startDate}
                    endTime={endDate}
                    timelineStyle={{
                        width: width,
                        margin: { ...margin, bottom: 30 }
                    }}
                    updateTimeScale={this.updateTimeScale}
                />}

            </div>
        )
    }
}

export interface TimelineProps {
    className?: string,
    title?: string,
    events: VEventGroup[],
    timeScale?: d3.ScaleTime<number, number>,
    timelineStyle: Partial<TimelineStyle>,
}

export interface TimelineStyle {
    width: number,
    height: number,
    color: string,
    margin: MarginType,
}

const defaultTimelineStyle: TimelineStyle = {
    width: 600,
    height: 80,
    color: "#aaa",
    margin: defaultMargin,
}

export class Timeline extends React.PureComponent<TimelineProps>{
    private ref: React.RefObject<SVGSVGElement> = React.createRef();
    constructor(props: TimelineProps) {
        super(props);

        this.paint = this.paint.bind(this);
    }

    componentDidMount() {
        this.paint();
    }

    componentDidUpdate(prevProps: TimelineProps) {
        if (prevProps !== this.props) {
            this.paint();
        }
    }

    // private paint() {
    //     const { entity, startTime, endTime } = this.props;
    //     const style = { ...defaultTimelineStyle, ...this.props.timelineStyle };
    //     const { width, height, color } = style;
    //     const margin = getMargin(style.margin);
    //     const groupedEntity = entity.groupBy(row => row[entity.timeIndex!]);
    //     const events = groupedEntity.toArray().map(group => {
    //         return {
    //             timestamp: new Date(group.first()[entity.timeIndex!]),
    //             count: group.count()
    //         }
    //     });
    //     const extend: [Date, Date] | undefined = startTime && endTime && [startTime, endTime];
    //     const timeScale = getScaleTime(0, width - margin.left - margin.right,
    //         events.map(e => e.timestamp), extend);
    //     const node = this.ref.current;
    //     if (node) {
    //         drawTimeline({
    //             events: events,
    //             svg: node,
    //             width: width,
    //             height: height,
    //             margin: margin,
    //             color: color,
    //             timeScale: timeScale,
    //         })
    //     }
    // }

    private paint() {
        const { events, timeScale } = this.props;
        const style = { ...defaultTimelineStyle, ...this.props.timelineStyle };
        const { width, height, color } = style;
        const margin = getMargin(style.margin);

        const node = this.ref.current;
        if (node) {
            drawTimeline2({
                events: events,
                svg: node,
                width: width,
                height: height,
                margin: margin,
                color: color,
                timeScale: timeScale,
                trackHeight: 10,
                trackMarginBottom: 2
            })
        }
    }

    public render() {
        const { className, events, title } = this.props;
        const style = { ...defaultTimelineStyle, ...this.props.timelineStyle };
        const margin = getMargin(style.margin);
        const maxTrack = (d3.max(events.map(e => e.track || 0)) || 0) + 2;
        const height = Math.max(maxTrack * (10 + 2) + margin.top + margin.bottom, 30)

        return <div className={"timeline" + (className ? ` ${className}` : "")}>
            <div className={"timeline-title"}>{title}</div>
            <div className={"timeline-content"}>
                <svg ref={this.ref} className={"timeline-svg"} style={{ height: height }} />
            </div>
        </div>
    }
}

export interface TimelineAxisProps {
    className?: string,
    startTime?: Date,
    endTime?: Date,
    timelineStyle: Partial<TimelineStyle>,
    updateTimeScale?: (scale: d3.ScaleTime<number, number>) => void
}

export class TimelineAxis extends React.PureComponent<TimelineAxisProps>{
    private ref: React.RefObject<SVGSVGElement> = React.createRef();
    constructor(props: TimelineAxisProps) {
        super(props);

        this._draw = this._draw.bind(this);
    }

    componentDidMount() {
        this._draw();
    }

    componentDidUpdate(prevProps: TimelineAxisProps) {
        if ((prevProps.startTime?.toString() !== this.props.startTime?.toString()) ||
            (prevProps.endTime?.toString() !== this.props.endTime?.toString())) {
            this._draw();
        }
    }

    private _draw() {
        const { startTime, endTime, updateTimeScale } = this.props;
        const style = { ...defaultTimelineStyle, ...this.props.timelineStyle };
        const { width, height, color } = style;
        const margin = getMargin(style.margin);
        if (startTime && endTime) {
            const extend: [Date, Date] = [startTime, endTime];
            const timeScale = getScaleTime(0, width - margin.left - margin.right,
                undefined, extend);
            const node = this.ref.current;
            if (node) {
                drawTimelineAxis({
                    svg: node,
                    width: width,
                    height: height,
                    margin: margin,
                    color: color,
                    defaultTimeScale: timeScale,
                    updateTimeScale: updateTimeScale
                })
            }
        }
    }

    public render() {
        const { className } = this.props;

        return <div className={"timeline" + (className ? ` ${className}` : "")}>
            <div className={"timeline-title"}><p></p></div>
            <div className={"timeline-content"}>
                <svg ref={this.ref} className={"timeline-svg"} />
            </div>
        </div>
    }
}
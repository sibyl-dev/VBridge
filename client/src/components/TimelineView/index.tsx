import * as React from "react";
import { PatientMeta } from "data/patient";
import { Entity } from "data/table";
import { defaultCategoricalColor, defaultMargin, getMargin, getScaleTime, IMargin, MarginType } from "visualization/common";
import { drawTimeline, drawTimelineAxis } from "visualization/timeline";
import Panel from "../Panel"
import "./index.css"

export interface TimelineViewProps {
    patientMeta?: PatientMeta,
    tableRecords?: Entity<number, any>[]
}

export interface TimelineViewStates {

}

export default class TimelineView extends React.Component<TimelineViewProps, TimelineViewStates> {
    private ref: React.RefObject<HTMLDivElement> = React.createRef();
    constructor(props: TimelineViewProps) {
        super(props);
        this.state = {};
    }

    public render() {
        const { patientMeta, tableRecords } = this.props;
        const startDate = patientMeta && new Date(patientMeta.startDate);
        const endDate = patientMeta && new Date(patientMeta.endDate);

        return (
            <Panel initialWidth={700} initialHeight={260} x={405} y={0}>
                <div ref={this.ref} className={"timeline-view-content"}>
                    {tableRecords?.map((entity, i) =>
                    (<Timeline
                        entity={entity}
                        key={i}
                        startTime={startDate}
                        endTime={endDate}
                        timelineStyle={{
                            color: defaultCategoricalColor(i),
                            margin: { left: 15 }
                        }}
                    />))}
                </div>
                {tableRecords && <TimelineAxis
                    className="fix-on-bottom"
                    startTime={startDate}
                    endTime={endDate}
                    timelineStyle={{ margin: { left: 15 } }}
                />}

            </Panel>
        )
    }
}

export interface TimelineProps {
    className?: string,
    entity: Entity<number, any>,
    startTime?: Date,
    endTime?: Date,
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
    height: 40,
    color: "#aaa",
    margin: defaultMargin,
}

export class Timeline extends React.PureComponent<TimelineProps>{
    private ref: React.RefObject<SVGSVGElement> = React.createRef();
    constructor(props: TimelineProps) {
        super(props);

        this._draw = this._draw.bind(this);
    }

    componentDidMount() {
        this._draw();
    }

    componentDidUpdate(prevProps: TimelineProps) {
        if (prevProps !== this.props) {
            this._draw();
        }
    }

    private _draw() {
        const { entity, startTime, endTime } = this.props;
        const style = { ...defaultTimelineStyle, ...this.props.timelineStyle };
        const { width, height, color } = style;
        const margin = getMargin(style.margin);
        const groupedEntity = entity.groupBy(row => row[entity.timeIndex!]);
        const events = groupedEntity.toArray().map(group => {
            return {
                timestamp: new Date(group.first()[entity.timeIndex!]),
                count: group.count()
            }
        });
        const extend: [Date, Date] | undefined = startTime && endTime && [startTime, endTime];
        const timeScale = getScaleTime(0, width - margin.left - margin.right,
            events.map(e => e.timestamp), extend);
        const node = this.ref.current;
        if (node) {
            drawTimeline({
                events: events,
                svg: node,
                width: width,
                height: height,
                margin: margin,
                color: color,
                timeScale: timeScale,
            })
        }
    }

    public render() {
        const { className, entity } = this.props;

        return <div className={"timeline" + (className ? ` ${className}` : "")}>
            <div className={"timeline-title"}>{entity.name}</div>
            <div className={"timeline-content"}>
                <svg ref={this.ref} className={"timeline-svg"} />
            </div>
        </div>
    }
}

export interface TimelineAxisProps {
    className?: string,
    startTime?: Date,
    endTime?: Date,
    timelineStyle: Partial<TimelineStyle>,
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
        if (prevProps !== this.props) {
            this._draw();
        }
    }

    private _draw() {
        const { startTime, endTime } = this.props;
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
                    timeScale: timeScale,
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
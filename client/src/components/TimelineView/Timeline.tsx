import { Button } from "antd";
import { IEvent } from "data/event";
import { Entity } from "data/table";
import React from "react";
import { defaultMargin, getMargin, MarginType } from "visualization/common";
import { drawTimeline } from "visualization/timeline";

export interface TimelineStyle {
    width: number,
    height: number,
    color: string,
    margin: MarginType,
}

export const defaultTimelineStyle: TimelineStyle = {
    width: 600,
    height: 45,
    color: "#aaa",
    margin: defaultMargin,
}

export interface TimelineProps {
    className?: string,
    title?: string,
    // events: VEventGroup[],
    tableRecord: Entity<number, any>,
    timeScale?: d3.ScaleTime<number, number>,
    timelineStyle: Partial<TimelineStyle>,
    onSelectEvents?: (startDate: Date, endDate: Date) => void,
}

export interface TimelineStates {
    showButton?: boolean,
}

export class Timeline extends React.Component<TimelineProps, TimelineStates>{
    private ref: React.RefObject<SVGSVGElement> = React.createRef();
    private shouldPaint: boolean = true;
    private events: IEvent[] = [];
    private selectedX?: [Date, Date];
    constructor(props: TimelineProps) {
        super(props);
        this.state = {};
        this.paint = this.paint.bind(this);
        this.updateEvents = this.updateEvents.bind(this);
        this.onSelectEvents = this.onSelectEvents.bind(this);
        this.onMouseLeave = this.onMouseLeave.bind(this);
        this.onMouseOver = this.onMouseOver.bind(this);
    }

    componentDidMount() {
        this.updateEvents();
        this.paint();
    }


    componentDidUpdate(prevProps: TimelineProps) {
        if (prevProps.tableRecord != this.props.tableRecord) {
            this.updateEvents();
            this.shouldPaint = true;
        }
        if (prevProps.timeScale?.domain()[0].getTime() !== this.props.timeScale?.domain()[0].getTime() ||
            prevProps.timeScale?.domain()[1].getTime() !== this.props.timeScale?.domain()[1].getTime()
        ) {
            // console.log(prevProps.timeScale?.domain(), this.props.timeScale?.domain());
            this.shouldPaint = true;
        }
        const delayedPaint = () => {
            if (this.shouldPaint) this.paint();
        };
        window.setTimeout(delayedPaint, 100);
    }

    private updateEvents() {
        const { tableRecord } = this.props
        const { timeIndex, name } = tableRecord;
        const groupedEntity = tableRecord.groupBy(row => row[tableRecord.timeIndex!]);
        this.events = groupedEntity.toArray().map(group => ({
            entityName: name!,
            timestamp: new Date(group.first()[timeIndex!]),
            count: group.count()
        }))
    }


    private onSelectEvents(startDate: Date, endDate: Date, update: boolean) {
        const { onSelectEvents } = this.props;
        this.selectedX = [startDate, endDate];
        onSelectEvents && update && onSelectEvents(startDate, endDate);
    }

    private onMouseOver() {
        this.setState({ showButton: true });
    }
    private onMouseLeave() {
        const delayed = () => this.setState({ showButton: false });
        window.setTimeout(delayed, 2000);
    }

    private paint() {
        const { timeScale } = this.props;
        const style = { ...defaultTimelineStyle, ...this.props.timelineStyle };
        const { width, height, color } = style;
        const margin = getMargin(style.margin);
        const node = this.ref.current;
        let events = this.events;
        if (timeScale) {
            const extent = timeScale.domain();
            events = events.filter(e => e.timestamp >= extent[0] && e.timestamp <= extent[1]);
        }
        if (node) {
            drawTimeline({
                events: events,
                node: node,
                width: width,
                height: height,
                margin: margin,
                color: color,
                timeScale: timeScale,
                onBrush: this.onSelectEvents,
                selectedX: this.selectedX,
                onMouseOver: this.onMouseOver,
                onMouseLeave: this.onMouseLeave,
                size:0,
            });
        }
        this.shouldPaint = false;
    }

    // private paint() {
    //     const { events, timeScale } = this.props;
    //     const style = { ...defaultTimelineStyle, ...this.props.timelineStyle };
    //     const { width, height, color } = style;
    //     const margin = getMargin(style.margin);

    //     const node = this.ref.current;
    //     if (node) {
    //         drawTimeline2({
    //             events: events,
    //             svg: node,
    //             width: width,
    //             height: height,
    //             margin: margin,
    //             color: color,
    //             timeScale: timeScale,
    //             trackHeight: 10,
    //             trackMarginBottom: 2
    //         })
    //     }
    // }

    public render() {
        const { className, title, timeScale } = this.props;
        const style = { ...defaultTimelineStyle, ...this.props.timelineStyle };
        const margin = getMargin(style.margin);
        const { showButton } = this.state;
        // const margin = getMargin(style.margin);
        // const maxTrack = (d3.max(events.map(e => e.track || 0)) || 0) + 2;
        // const height = Math.max(maxTrack * (10 + 2) + margin.top + margin.bottom, 30)
        // const height = 80;

        return <div className={"timeline" + (className ? ` ${className}` : "")}>
            <div className={"timeline-title"}>{title}</div>
            <div className={"timeline-content"}>
                <Button style={{
                    position: 'absolute', display: showButton ? 'block' : 'none',
                    left: (timeScale && this.selectedX) ? timeScale(this.selectedX[1]) + margin.left + 70 : 0,
                    top: style.height/2 + margin.top - 20
                }}
                    type="primary" shape="round" size="small" className="detail-button">Details</Button>
                <svg ref={this.ref} className={"timeline-svg"} style={{ height: style.height }} />
            </div>
        </div>
    }
}
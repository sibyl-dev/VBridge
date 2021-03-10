import * as React from "react"

import { IEvent } from "data/event";
import { defaultTimelineStyle, TimelineStyle } from "./Timeline";
import { getMargin, getScaleTime } from "visualization/common";
import { drawTimelineAxis } from "visualization/timelineAxis";

export interface TimelineAxisProps {
    className?: string,
    events?: IEvent[][],
    startTime?: Date,
    endTime?: Date,
    color?: (id: number) => string,
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
            (prevProps.endTime?.toString() !== this.props.endTime?.toString()) ||
            (prevProps.events != this.props.events)
        ) {
            this._draw();
        }
    }

    private _draw() {
        const { startTime, endTime, updateTimeScale, events, color } = this.props;
        const style = { ...defaultTimelineStyle, ...this.props.timelineStyle };
        const { width, height } = style;
        const margin = getMargin(style.margin);
        if (startTime && endTime) {
            const extend: [Date, Date] = [startTime, endTime];
            const timeScale = getScaleTime(0, width - margin.left - margin.right,
                undefined, extend).nice();
            const node = this.ref.current;
            if (node) {
                drawTimelineAxis({
                    svg: node,
                    width: width,
                    height: height,
                    margin: margin,
                    color: color,
                    defaultTimeScale: timeScale,
                    updateTimeScale: updateTimeScale,
                    drawAreaChart: true,
                    events: events,
                })
            }
        }
    }

    public render() {
        const { className } = this.props;
        const style = { ...defaultTimelineStyle, ...this.props.timelineStyle };

        return<div className={"timeline-axis-content"}>
                <svg ref={this.ref} className={"timeline-svg"} height={style.height} />
            </div>
    }
}
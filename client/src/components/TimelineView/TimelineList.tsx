import * as _ from "lodash"
import { Button } from "antd";
import { IEvent } from "data/event";
import React from "react";
import { defaultMargin, getMargin, IMargin, MarginType } from "visualization/common";
import { drawTimeline } from "visualization/timeline";
import { drawTimelineList } from "visualization/timeline3";

export interface TimelineStyle {
    width: number,
    height: number,
    color: string,
    margin: IMargin,
}

export const defaultTimelineStyle: TimelineStyle = {
    width: 600,
    height: 45,
    color: "#aaa",
    margin: defaultMargin,
}

export interface TimelineListProps {
    className?: string,
    titles: (string | undefined)[],
    events: IEvent[][],
    timeScale?: d3.ScaleTime<number, number>,
    timelineStyle: Partial<TimelineStyle>,
    onSelectEvents?: (id: number, startDate: Date, endDate: Date) => void,
    color: (id: number) => string,
    margin: IMargin,
    size: number,
    calculateNewTime?: (time: Date) => Date|undefined,
}

export interface TimelineListStates {
    showButton: boolean[],
    buttonRow?: number,
}

export class TimelineList extends React.Component<TimelineListProps, TimelineListStates>{
    private ref: React.RefObject<SVGSVGElement> = React.createRef();
    private shouldPaint: boolean = true;
    private selectedX: ([Date, Date] | undefined)[];

    constructor(props: TimelineListProps) {
        super(props);
        this.state = { showButton: _.range(0, props.events.length).map(() => false) };

        this.selectedX = _.range(0, props.events.length).map(() => undefined);

        this.paint = this.paint.bind(this);
        this.onSelectEvents = this.onSelectEvents.bind(this);
        this.onMouseLeave = this.onMouseLeave.bind(this);
        this.onMouseOver = this.onMouseOver.bind(this);
    }

    componentDidMount() {
        this.paint();
    }


    componentDidUpdate(prevProps: TimelineListProps) {
        if (prevProps.events != this.props.events) {
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


    private onSelectEvents(id: number, startDate: Date, endDate: Date, update: boolean) {
        const { onSelectEvents } = this.props;
        this.selectedX[id] = [startDate, endDate];
        console.log('here onSelectEvents', startDate, endDate)
        onSelectEvents && update && onSelectEvents(id, startDate, endDate);
    }

    private onMouseOver(id: number) {
        const { showButton } = this.state;
        showButton[id] = true;
        this.setState({ showButton, buttonRow: id });
    }
    private onMouseLeave(id: number) {
        const delayed = () => {
            const { showButton } = this.state;
            showButton[id] = false;
            this.setState({ showButton })
        };
        window.setTimeout(delayed, 2000);
    }

    private paint() {
        const { timeScale, color, size } = this.props;
        const style = { ...defaultTimelineStyle, ...this.props.timelineStyle };
        const { width, height, margin } = style;
        // console.log('TimelineList paint', style.margin, defaultTimelineStyle, this.props.timelineStyle )
        const node = this.ref.current;
        let events = this.props.events;
        if (timeScale) {
            const extent = timeScale.domain();
            events = events.map(es => es.filter(e => e.timestamp >= extent[0] && e.timestamp <= extent[1]));
        }
        if (node && size && this.props.calculateNewTime) {
            drawTimelineList({
                events: events,
                node: node,
                width: width,
                margin: this.props.margin,
                rowHeight: height,
                rowMargin: margin,
                color: color,
                timeScale: timeScale,
                onBrush: this.onSelectEvents,
                selectedX: this.selectedX,
                onMouseOver: this.onMouseOver,
                onMouseLeave: this.onMouseLeave,
                size: size,
                calculateNewTime: this.props.calculateNewTime,
            });
        }
        this.shouldPaint = false;
    }

    public render() {
        const { className, titles, timeScale, margin, events } = this.props;
        const { showButton, buttonRow } = this.state;
        const style = { ...defaultTimelineStyle, ...this.props.timelineStyle };
        const buttonXPos = (buttonRow !== undefined) && timeScale && (timeScale(this.selectedX[buttonRow]![1]) + margin.left + 40);
        const buttonYPos = (buttonRow !== undefined) && (style.height * (1 / 2 + buttonRow) + margin.top) - 5;
        const height = style.height * events.length + margin.top + margin.bottom;

        return <div className={"timeline-list" + (className ? ` ${className}` : "")}>
            <div className={"timeline-title-list"}>
                {titles?.map(title => <div className={"timeline-title"} style={{ height: style.height }} key={title}>{title}</div>)}
            </div>
            <div className={"timeline-content"}>
                {buttonXPos && buttonYPos && <Button style={{
                    position: 'absolute', display: _.sum(showButton) > 0 ? 'block' : 'none',
                    left: buttonXPos, top: buttonYPos
                }}
                    type="primary" shape="round" size="small" className="detail-button">Details</Button>}
                <svg ref={this.ref} className={"timeline-svg"} style={{ height: height }} />
            </div>
        </div>
    }
}
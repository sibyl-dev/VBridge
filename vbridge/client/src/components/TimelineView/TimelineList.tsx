import * as _ from "lodash"
import { Button } from "antd";
import { IEventBin, MetaEvent } from "data/event";
import React from "react";
import { defaultMargin, IMargin } from "visualization/common";
import { drawTimelineList } from "visualization/timeline3";
import { LineChartOutlined, TableOutlined } from "@ant-design/icons";

export interface TimelineStyle {
    width: number,
    height: number,
    color: string,
    margin: IMargin,
}

export const defaultTimelineStyle: TimelineStyle = {
    width: 600,
    height: 40,
    color: "#aaa",
    margin: defaultMargin,
}

export interface TimelineListProps {
    className?: string,
    titles: (string | undefined)[],
    events: IEventBin[][],
    metaEvents?: MetaEvent[],
    timeScale?: d3.ScaleTime<number, number>,
    timelineStyle: Partial<TimelineStyle>,
    onSelectEvents?: (id: number, startDate: Date, endDate: Date) => void,
    color: (id: number) => string,
    margin: IMargin,
    // size: number,
    calculateNewTime?: (time: Date) => Date | undefined,
    intervalByQuarter?: number,
}

export interface TimelineListStates {
    showButton: boolean[],
    buttonRow?: number,
}

export class TimelineList extends React.Component<TimelineListProps, TimelineListStates>{
    private ref: React.RefObject<SVGSVGElement> = React.createRef();
    private shouldPaint: boolean = true;
    private selectedX: ([Date, Date] | undefined)[];
    private focusedId: number = 0;

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
        this.selectedX[id] = [startDate, endDate];
        this.focusedId = id;
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
        const { timeScale, color, metaEvents, intervalByQuarter } = this.props;
        const style = { ...defaultTimelineStyle, ...this.props.timelineStyle };
        const { width, height, margin } = style;
        const node = this.ref.current;
        let events = this.props.events;
        // if (timeScale) {
        //     const extent = timeScale.domain();
        //     events = events.map(es => es.filter(e => e.timestamp >= extent[0] && e.timestamp < extent[1]));
        // }
        if (node) {
            drawTimelineList({
                metaEvents: metaEvents,
                events: events,
                node: node,
                width: width,
                margin: this.props.margin,
                rowHeight: height,
                rowMargin: margin,
                color: color,
                timeScale: timeScale,
                onBrush: this.onSelectEvents,
                // selectedX: this.selectedX,
                onMouseOver: this.onMouseOver,
                onMouseLeave: this.onMouseLeave,
                calculateNewTime: this.props.calculateNewTime,
                intervalByQuarter: intervalByQuarter
            });
        }
        this.shouldPaint = false;
    }

    public render() {
        const { className, titles, timeScale, margin, events, color, onSelectEvents } = this.props;
        const { showButton, buttonRow } = this.state;
        const style = { ...defaultTimelineStyle, ...this.props.timelineStyle };
        const selectedX = this.selectedX;
        const focusedId = this.focusedId;
        const buttonXPos = (buttonRow !== undefined) && timeScale && (timeScale(this.selectedX[buttonRow]![1]) + margin.left + 25);
        const buttonYPos = (buttonRow !== undefined) && (style.height * (1 / 2 + buttonRow) + margin.top) - 5;
        const height = style.height * events.length + margin.top + margin.bottom;

        return <div className={"timeline-list" + (className ? ` ${className}` : "")}>
            <div className={"timeline-title-list"}>
                {titles?.map((title, i) => <div className={"timeline-title"}
                    style={{ height: style.height, borderLeftColor: color(i), borderLeftWidth: 4 }} key={title}>
                        <span className={"timeline-title-text"}>{title==='Chart Signs'?'Chart Events':title}</span></div>)}
            </div>
            <div className={"timeline-content"}>
                {buttonXPos && buttonYPos && selectedX && <Button size="small" type="primary" shape="circle"
                    icon={<LineChartOutlined />}
                    onClick={() => onSelectEvents && onSelectEvents(focusedId, selectedX[focusedId]![0], selectedX[focusedId]![1])}
                    style={{
                        position: 'absolute', display: _.sum(showButton) > 0 ? 'block' : 'none',
                        left: buttonXPos, top: buttonYPos - 3
                    }}
                    className={"feature-button-linechart"}
                />}
                {buttonXPos && buttonYPos && <Button size="small" type="primary" shape="circle"
                    icon={<TableOutlined />}
                    style={{
                        position: 'absolute', display: _.sum(showButton) > 0 ? 'block' : 'none',
                        left: buttonXPos, top: buttonYPos + 28
                    }}
                    className={"feature-button-table"}
                />}
                <svg ref={this.ref} className={"timeline-svg"} style={{ height: height+20 }} />
            </div>
        </div>
    }
}
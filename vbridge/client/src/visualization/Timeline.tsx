import * as d3 from "d3"
import * as React from "react"
import * as _ from "lodash"
import { Button } from "antd";
import { LineChartOutlined, TableOutlined } from "@ant-design/icons";

import { IEventBin } from "data/event";
import { getChildOrAppend, getScaleLinear, getScaleTime, getMargin, ChartStyle } from "./common";
import "./Timeline.scss"

export interface TimelineData {
    events: IEventBin[],
    binTime?: number,
}

export interface TimelineStyle extends ChartStyle {
    timeScale?: d3.ScaleTime<number, number>,
    drawTicks?: boolean,
}

export interface TimelineActions {
    onBrush?: (startTime?: Date, endTime?: Date) => void,
    onMouseOver?: () => void;
    onMouseLeave?: () => void;
}

export type TimelineParam = TimelineData & TimelineStyle & TimelineActions;

export function drawTimeline(params: TimelineParam & { node: SVGElement | SVGGElement }) {
    const { events, node, timeScale, binTime, drawTicks, onBrush, onMouseOver, onMouseLeave } = params
    const root = d3.select(node);
    const margin = getMargin(params.margin || {});
    const height = params.height - margin.top - margin.bottom;
    const width = params.width - margin.left - margin.right;
    const xScale = timeScale || getScaleTime(0, width, [...events.map(e => e.binStartTime), ...events.map(e => e.binEndTime)]);
    const brightScale = getScaleLinear(0.2, 0.5, undefined, [0, d3.max(events.map(d => d.count))!]);
    const colorScale = (id: number) => d3.interpolateBlues(brightScale(id));

    const base = getChildOrAppend<SVGGElement, SVGElement>(root, "g", "base")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    /* Drawing Axis */
    const axisBase = getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "axis-base")
        .attr("transform", `translate(0, ${height})`);
    getChildOrAppend<SVGLineElement, SVGGElement>(axisBase, "line", "axis-line")
        .attr("class", "axis-line")
        .attr("x2", width);

    /* Drawing Ticks */
    if (binTime) {
        const startTime = xScale.domain()[0];
        const endTime = xScale.domain()[1];
        const tickNum = Math.floor((endTime.getTime() - startTime.getTime()) / binTime) + 1;
        const tickBins = _.range(0, tickNum).map(t => new Date(startTime.getTime() + binTime * t));

        const tickBase = getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "tick-base");
        const tickGroups = tickBase.selectAll('.time-tick-group')
            .data(tickBins)
            .join(
                enter => enter.append("g").attr("class", 'time-tick-group'),
                update => update,
                remove => remove.exit()
            )
            .attr("transform", d => `translate(${xScale(d)}, 10)`)
            .attr("display", drawTicks ? 'block' : 'none');

        tickGroups.selectAll('.time-tick-text')
            .data(d => [d])
            .join(
                enter => enter.append("text").attr("class", 'time-tick-text'),
                update => update,
                remove => remove.exit()
            )
            .attr("dx", -14)
            .text(d => (d.getHours() === 0) ? `${d.getDate()}th` : `${d.getHours()}:00`);

        tickGroups.selectAll('.time-tick')
            .data(d => [d])
            .join(
                enter => enter.append("line").attr("class", 'time-tick'),
                update => update,
                remove => remove.exit()
            )
            .attr("transform", d => `translate(0, 3)`)
            .attr("y2", 6);
    }

    /* Drawing Cells */
    const cellPadding = 1;
    const tickHeight = drawTicks ? 20 : 0;
    const cellHeight = height - 2 * cellPadding - tickHeight;
    const cellWidth = events[0] ? xScale(events[0].binEndTime) - xScale(events[0].binStartTime) - cellPadding * 2 : width;

    const cellBase = getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "cell-base")
        .attr("transform", `translate(0, ${tickHeight})`);
    const cells = cellBase.selectAll(".timeline-cell")
        .data(events)
        .join<SVGGElement>(
            enter => enter
                .append("g")
                .attr("class", "timeline-cell"),
            update => update,
            exit => exit.remove())
        .attr("transform", d => `translate(${xScale(d.binStartTime) + cellPadding}, ${cellPadding})`)

    cells.selectAll(".timeline-cell-outer")
        .data(d => [d])
        .join<SVGRectElement>(
            enter => enter.append("rect")
                .attr("class", "timeline-cell-outer"),
            update => update,
            exit => exit.remove())
        .attr('width', cellWidth)
        .attr("height", cellHeight)
        .style("fill", d => colorScale(d.count))
        .attr("rx", 2)

    cells.selectAll(".timeline-cell-inner")
        .data(d => [d])
        .join<SVGRectElement>(
            enter => enter.append("rect")
                .attr("class", "timeline-cell-inner"),
            update => update,
            exit => exit.remove())
        .attr("transform", d => `translate(${cellWidth * (1 - d.abnormalItems!.length / d.items!.length) / 2}, 
            ${cellHeight * (1 - d.abnormalItems!.length / d.items!.length) / 2})`)
        .attr('width', d => cellWidth * (d.abnormalItems!.length / d.items!.length))
        .attr("height", d => cellHeight * (d.abnormalItems!.length / d.items!.length))
        .attr("rx", 2);

    /* Brushing Actions */
    const brush = d3.brushX()
        .extent([[0, 0], [width, height]])
        .on("end", brushend);

    function brushend(event: { selection: [number, number] }) {
        const { selection } = event;
        if (selection) {
            const extent = selection.map(xScale.invert);
            onBrush && onBrush(extent[0], extent[1]);
        }
        else {
            onBrush && onBrush();
        }
    }

    cellBase.call(brush);

    onMouseOver && base.select(".selection")
        .on("mouseover", onMouseOver);
    onMouseLeave && base.select(".selection")
        .on("mouseleave", onMouseLeave);
}

export interface TimelineProps extends TimelineParam {
    className?: string
    style?: React.CSSProperties,

    onSelectEvents?: (startDate: Date, endDate: Date) => void,
}

interface TimelineState {
    brushedRange?: [Date, Date];
    showButton: boolean;
}

export default class Timeline extends React.PureComponent<TimelineProps, TimelineState>{
    private ref: React.RefObject<SVGSVGElement> = React.createRef();
    constructor(props: TimelineProps) {
        super(props);

        this.state = { showButton: false };

        this.onBrush = this.onBrush.bind(this);
        this.onMouseOver = this.onMouseOver.bind(this);
        this.onMouseLeave = this.onMouseLeave.bind(this);
    }
    componentDidMount() {
        this.paint();
    }

    componentDidUpdate(prevProps: TimelineParam) {
        if (prevProps !== this.props) {
            this.paint();
        }
    }

    private onBrush(startTime?: Date, endTime?: Date) {
        if (startTime !== undefined && endTime !== undefined) {
            this.setState({ brushedRange: [startTime, endTime] });
        }
        else {
            this.setState({ brushedRange: undefined });
        }
    }

    private onMouseOver() {
        this.setState({ showButton: true });
    }
    private onMouseLeave() {
        const delayed = () => {
            this.setState({ showButton: false })
        };
        window.setTimeout(delayed, 2000);
    }

    private paint() {
        const { ...rest } = this.props;
        const node = this.ref.current;
        if (node) {
            drawTimeline({
                node,
                onBrush: this.onBrush,
                onMouseLeave: this.onMouseLeave,
                onMouseOver: this.onMouseOver,
                ...rest
            });
        }
    }

    public render() {
        const { className, height, width, timeScale, style, events, onSelectEvents } = this.props;
        const { showButton, brushedRange } = this.state;
        const xScale = timeScale || getScaleTime(0, width, [...events.map(e => e.binStartTime), ...events.map(e => e.binEndTime)]);
        return <div className={"timeline" + (className ? ` ${className}` : "")} style={style}>
            {brushedRange && <Button size="small" type="primary" shape="circle"
                icon={<LineChartOutlined />}
                onClick={() => onSelectEvents && onSelectEvents(brushedRange[0], brushedRange[1])}
                style={{
                    position: 'absolute', display: showButton ? 'block' : 'none',
                    left: xScale(brushedRange[1]) + 10, top: height / 2 - 25
                }}
                className={"feature-button-linechart"}
            />}
            {brushedRange && <Button size="small" type="primary" shape="circle"
                icon={<TableOutlined />}
                style={{
                    position: 'absolute', display: showButton ? 'block' : 'none',
                    left: xScale(brushedRange[1]) + 10, top: height / 2 + 5
                }}
                className={"feature-button-table"}
            />}
            <svg ref={this.ref} className={"timeline-svg"} style={{ width: width, height: height }} />
        </div>
    }
}
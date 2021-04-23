import * as d3 from "d3"
import * as React from "react"
import { IEventBin } from "data/event";
import { getChildOrAppend, getScaleLinear, getScaleTime, IMargin, getMargin, ChartStyle } from "./common";
import "./Timeline.css"

export interface TimelineData {
    events: IEventBin[],
}

export interface TimelineStyle extends ChartStyle {
    timeScale?: d3.ScaleTime<number, number>,
}

export interface TimelineActions {
    onBrush?: (startDate: Date, endDate: Date, update: boolean) => void,
    onMouseOver?: () => void;
    onMouseLeave?: () => void;
}

export type TimelineParam = TimelineData & TimelineStyle & TimelineActions;

export function drawTimeline(params: TimelineParam & { node: SVGElement | SVGGElement }) {
    const { events, node, timeScale, onBrush, onMouseOver, onMouseLeave } = params
    const root = d3.select(node);
    const margin = getMargin(params.margin || {});
    const height = params.height - margin.top - margin.bottom;
    const width = params.width - margin.left - margin.right;
    const cellPadding = 1;

    const base = getChildOrAppend<SVGGElement, SVGElement>(root, "g", "base")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    const axisBase = getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "axis-base")
        .attr("transform", `translate(0, ${height})`);

    getChildOrAppend<SVGLineElement, SVGGElement>(axisBase, "line", "axis-line")
        .attr("class", "axis-line")
        .attr("x2", width);

    const xScale = timeScale || getScaleTime(0, width, [...events.map(e => e.binStartTime), ...events.map(e => e.binEndTime)]);
    const brightScale = getScaleLinear(0.2, 0.5, undefined, [0, d3.max(events.map(d => d.count))!]);
    const colorScale = (id: number) => d3.interpolateBlues(brightScale(id));

    const cellHeight = height - 2 * cellPadding;
    const cellWidth = events[0] ? xScale(events[0].binEndTime) - xScale(events[0].binStartTime) - cellPadding * 2 : width;

    const cellBase = getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "cell-base")
    const cells = cellBase.selectAll(".timeline-cell")
        .data(events)
        .join<SVGGElement>(enter => {
            return enter
                .append("g")
                .attr("class", "timeline-cell");
        }, update => update,
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
        .attr("rx", 2)

    const brush = d3.brushX()
        .extent([[0, 0], [width, height]])
        .on("end", brushend);

    function brushend(event: { selection: [number, number] }) {
        const { selection } = event;
        if (selection) {
            const extent = selection.map(xScale.invert);
            onBrush && onBrush(extent[0], extent[1], true);
        }
    }

    base.call(brush);

    onMouseOver && base.select(".selection")
        .on("mouseover", onMouseOver);

    onMouseLeave && base.select(".selection")
        .on("mouseleave", onMouseLeave);
}

export interface TimelineProps extends TimelineParam {
    className?: string
    style?: React.CSSProperties,
}

export default class Timeline extends React.PureComponent<TimelineProps>{
    private ref: React.RefObject<SVGSVGElement> = React.createRef();
    constructor(props: TimelineProps) {
        super(props);
    }
    componentDidMount() {
        this.paint();
    }

    componentDidUpdate(prevProps: TimelineParam) {
        if (prevProps !== this.props) {
            this.paint();
        }
    }

    paint() {
        const { ...rest } = this.props;
        const node = this.ref.current;
        if (node) {
            drawTimeline({ node, ...rest });
        }
    }

    public render() {
        const { className, height, width, style } = this.props;
        return <div className={"timeline" + (className ? ` ${className}` : "")} style={style}>
            <svg ref={this.ref} className={"timeline-svg"} style={{ width: width, height: height }} />
        </div>
    }
}
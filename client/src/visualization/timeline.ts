import * as d3 from "d3"
import { IEventBin, MetaEvent } from "data/event";
import { getChildOrAppend, getScaleLinear, getScaleTime, defaultCategoricalColor, IMargin, getMargin } from "./common";
import "./timeline.css"

export function drawTimeline(params: {
    events: IEventBin[],
    node: SVGElement | SVGGElement,
    width: number,
    height: number,
    margin?: IMargin,
    timeScale?: d3.ScaleTime<number, number>,
    // rectMargin?: IMargin, 
    color?: string,
    onBrush?: (startDate: Date, endDate: Date, update: boolean) => void,
    // selectedX?: [Date, Date],
    onMouseOver?: () => void;
    onMouseLeave?: () => void;
}) {
    const { color, events, node, timeScale, onBrush, onMouseOver, onMouseLeave } = params
    // console.log('drawTimeline', params)
    const root = d3.select(node);
    const margin = getMargin(params.margin || {});
    const height = params.height - margin.top - margin.bottom;
    const width = params.width - margin.left - margin.right;
    const cellPadding = 1;

    const base = getChildOrAppend<SVGGElement, SVGElement>(root, "g", "base")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    const axisBase = getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "axis-base")
        .attr("transform", `translate(0, ${height})`);
    const bubbleBase = getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "bubble-base")


    const axis = getChildOrAppend<SVGLineElement, SVGGElement>(axisBase, "line", "axis-line")
        .attr("class", "axis-line")
        .attr("x2", width);

    const t = timeScale || getScaleTime(0, width, [...events.map(e => e.binStartTime), ...events.map(e => e.binEndTime)]);
    // const r = getScaleLinear(0, 30, events.map(d => d.count));
    const opacity = getScaleLinear(0, 0.8, undefined, [0, d3.max(events.map(d => d.count))!]);
    // getChildOrAppend(base, "rect", "base-rect")
    //     .attr("width", width)
    //     .attr("height", height)
    //     .style("fill", 'none')
    //     .on("mouseover", e => console.log(e));

    let brush = d3.brushX()
        .extent([[0, 0], [width, height]])
        .on("brush", brushed)
        .on("end", brushend);

    base.call(brush);

    onMouseOver && base.select(".selection")
        .on("mouseover", onMouseOver);

    onMouseLeave && base.select(".selection")
        .on("mouseleave", onMouseLeave);


    const leftTimeAnno = getChildOrAppend(base, "text", "left-time-annotation");
    const rightTimeAnno = getChildOrAppend(base, "text", "right-time-annotation");

    function brushed(event: { selection: [number, number] }) {
        const { selection } = event;
        if (selection) {
            let extent = selection.map(t.invert);
            // extent = calExtentRange(extent)
            updateHandle(extent as [Date, Date]);
            onBrush && onBrush(extent[0], extent[1], false);
        }
        else {
            updateHandle();
        }
    }

    function brushend(event: { selection: [number, number] }) {
        const { selection } = event;
        if (selection) {
            let extent = selection.map(t.invert);
            // extent = calExtentRange(extent)
            updateHandle(extent as [Date, Date]);
            onBrush && onBrush(extent[0], extent[1], true);
        }
        else {
            updateHandle();
        }
    }

    function updateHandle(extent?: [Date, Date]) {
        if (extent) {
            leftTimeAnno.attr('transform', `translate(${t(extent[0])}, -5)`)
                .text(`${extent[0].toLocaleTimeString()}`)
                .attr("display", "block");
            rightTimeAnno.attr('transform', `translate(${t(extent[1])}, -5)`)
                .text(`${extent[1].toLocaleTimeString()}`)
                .attr("display", "block");
        }
        else {
            leftTimeAnno
                .attr("display", "none");
            rightTimeAnno
                .attr("display", "none");
        }
    }

    bubbleBase.selectAll(".timeline-cell")
        .data(events)
        .join<SVGRectElement>(enter => {
            return enter
                .append("rect")
                .attr("class", "timeline-cell");
        }, update => update,
            exit => { exit.remove() })
        .attr("x", d => t(d.binStartTime) + cellPadding)
        .attr('y', cellPadding)
        .attr("rx", 2)
        .attr('width', d => t(d.binEndTime) - t(d.binStartTime) - cellPadding * 2)
        .attr("height", height - cellPadding)
        .style("fill", defaultCategoricalColor(0))
        .style('opacity', d => opacity(d.count))

    // bubbleBase.selectAll(".timeline-cell-inner")
    //     .data(events)
    //     .join<SVGRectElement>(enter => {
    //         return enter
    //             .append("rect")
    //             .attr("class", "timeline-cell-inner");
    //     }, update => update,
    //         exit => { exit.remove() })
    //     .attr("x", d => t(d.binStartTime) + cellPadding +
    //         (t(d.binEndTime) - t(d.binStartTime) - cellPadding * 2) * (d.abnormalItems!.length / d.items!.length) / 2)
    //     .attr('y', d => cellPadding + ((height - cellPadding * 2)) * (d.abnormalItems!.length / d.items!.length) / 2)
    //     .attr("rx", 2)
    //     .attr('width', d => (t(d.binEndTime) - t(d.binStartTime) - cellPadding * 2) * (1 - d.abnormalItems!.length / d.items!.length))
    //     .attr("height", d => (height - cellPadding * 2) * (1 - d.abnormalItems!.length / d.items!.length))
    //     .style("fill", defaultCategoricalColor(0))
    //     .style('opacity', d => opacity(d.count))

    bubbleBase.selectAll(".timeline-cell-inner")
    .data(events)
    .join<SVGRectElement>(enter => {
        return enter
            .append("rect")
            .attr("class", "timeline-cell-inner");
    }, update => update,
        exit => { exit.remove() })
    .attr("x", d => t(d.binStartTime) + cellPadding +
        (t(d.binEndTime) - t(d.binStartTime) - cellPadding * 2) * (1 - d.abnormalItems!.length / d.items!.length) / 2)
    .attr('y', d => cellPadding + ((height - cellPadding * 2)) * (1 - d.abnormalItems!.length / d.items!.length) / 2)
    .attr("rx", 2)
    .attr('width', d => (t(d.binEndTime) - t(d.binStartTime) - cellPadding * 2) * (d.abnormalItems!.length / d.items!.length))
    .attr("height", d => (height - cellPadding * 2) * (d.abnormalItems!.length / d.items!.length))
    // .style("fill", color?color:defaultCategoricalColor(0))
    .style("fill", defaultCategoricalColor(0))
    // .style("fill", "#000")
    .style('opacity', d => opacity(d.count))

    // .style('stroke', 'black')
    // .style('stroke-width', '1px')
    // .attr("transform", d=> `translate(0, ${height - r(d.count)})`);
    // d => r(d.count)
    // selectedX && base.call(brush.move, [t(selectedX[0]), t(selectedX[1])]);
    // updateHandle(selectedX);
}
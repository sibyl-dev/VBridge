import * as d3 from "d3"
import * as _ from "lodash"
import { getChildOrAppend, IMargin, getMargin } from "./common";
import { drawTimeline } from "./timeline";
import "./timeline.css"

export type Event = {
    timestamp: Date,
    count: number,
}

export function drawTimelineList(params: {
    events: Event[][],
    node: SVGElement,
    size: number,

    width: number,
    margin?: IMargin,
    rowHeight: number,
    rowMargin?: IMargin,
    timeScale?: d3.ScaleTime<number, number>,
    color?: (id: number) => string,
    onBrush?: (id: number, startDate: Date, endDate: Date, update: boolean) => void,
    selectedX?: ([Date, Date] | undefined)[],
    onMouseOver?: (id: number) => void;
    onMouseLeave?: (id: number) => void;
    calculateNewTime?: (time: Date) => Date|undefined,
}) {
    const { color, events, node, timeScale, onBrush, selectedX, onMouseOver, onMouseLeave, rowHeight, rowMargin, size, calculateNewTime } = params
    const root = d3.select(node);
    const margin = getMargin(params.margin || {});
    const width = params.width - margin.left - margin.right;

    const base = getChildOrAppend<SVGGElement, SVGElement>(root, "g", "base")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const rowBases = _.range(0, events.length).map(id => getChildOrAppend<SVGGElement, SVGGElement>(base, "g", `row-base-${id}`));
    rowBases.forEach((base, i) => base.attr("transform", `translate(0, ${rowHeight * i})`));
    rowBases.forEach((d, i) => {
        const node = d.node();
        if (node && calculateNewTime) {
            drawTimeline({
                events: events[i],
                node: node,
                width: width,
                height: rowHeight,
                margin: rowMargin,
                timeScale: timeScale,
                color: color && color(i),
                onBrush: onBrush && ((startDate: Date, endDate: Date, update: boolean) =>
                    onBrush(i, startDate, endDate, update)),
                selectedX: selectedX && selectedX[i],
                onMouseOver: onMouseOver && (() => onMouseOver(i)),
                size: size,
                onMouseLeave: onMouseLeave && (() => onMouseLeave(i)),
                calculateNewTime: calculateNewTime,
            })
        }
    })

    getChildOrAppend<SVGRectElement, SVGGElement>(base, "rect", `base-rec`)
        .attr("width", width)
        .attr("height", rowHeight * events.length)
        .style("fill", "none");

    const subline = getChildOrAppend<SVGLineElement, SVGGElement>(base, "line", `subline`)
        .attr("y1", 0)
        .attr("y2", rowHeight * events.length)
        .style("display", `none`);

    base.on("mousemove", (event, d) => {
        subline.attr("x1", event.offsetX-2)
            .attr("x2", event.offsetX-2);
    });

    base.on("mouseover", () => {
        subline.style("display", `block`);
    });
    base.on("mouseleave", () => {
        subline.style("display", `none`);
    });
}
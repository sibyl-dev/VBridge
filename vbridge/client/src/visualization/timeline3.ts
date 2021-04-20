import * as d3 from "d3"
import { IEventBin, MetaEvent } from "data/event";
import * as _ from "lodash"
import { remove } from "lodash";
import { getChildOrAppend, IMargin, getMargin } from "./common";
import { drawTimeline } from "./timeline";
import "./timeline.css"

export type Event = {
    timestamp: Date,
    count: number,
}

export function drawTimelineList(params: {
    events: IEventBin[][],
    metaEvents?: MetaEvent[],
    node: SVGElement,
    // size: number,

    width: number,
    margin?: IMargin,
    rowHeight: number,
    rowMargin?: IMargin,
    timeScale?: d3.ScaleTime<number, number>,
    color?: (id: number) => string,
    onBrush?: (id: number, startDate: Date, endDate: Date, update: boolean) => void,
    // selectedX?: ([Date, Date] | undefined)[],
    onMouseOver?: (id: number) => void;
    onMouseLeave?: (id: number) => void;
    calculateNewTime?: (time: Date) => Date | undefined,
    intervalByQuarter?: number;
}) {
    const { color, events, node, timeScale, onBrush, onMouseOver, onMouseLeave, rowHeight, rowMargin, metaEvents, intervalByQuarter } = params
    const root = d3.select(node);
    const margin = getMargin(params.margin || {});
    const width = params.width - margin.left - margin.right;

    const base = getChildOrAppend<SVGGElement, SVGElement>(root, "g", "base")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const contentBase = getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "content-base")
        .attr("transform", `translate(0, 20)`);

    if (intervalByQuarter && timeScale) {
        const startTime = timeScale.domain()[0];
        const endTime = timeScale.domain()[1];
        const binTime = (intervalByQuarter * 1000 * 60 * 15)
        const tickNum = Math.floor((endTime.getTime() - startTime.getTime()) / binTime) + 1;
        const tickBin = _.range(0, tickNum).map(t => new Date(startTime.getTime() + binTime * t));
        const tickGroups = base.selectAll('.time-tick-text')
            .data(tickBin)
            .join(
                enter => enter.append("text").attr("class", 'time-tick-text'),
                update => update,
                remove => remove.exit()
            )
            .attr("transform", d => `translate(${timeScale(d)}, 10)`)
        // tickGroups.select('.time-tick-text')
        //     .datum(d => d)
        //     .join(
        //         enter => enter.append("text").attr("class", 'time-tick-text'),
        //         update => update,
        //         remove => remove.exit()
        //     )
            .text(d => (d.getHours() === 0)?`${d.getDate()}th`:`${d.getHours()}:00`)

            base.selectAll('.time-tick')
            .data(tickBin)
            .join(
                enter => enter.append("line").attr("class", 'time-tick'),
                update => update,
                remove => remove.exit()
            )
            .attr("transform", d => `translate(${timeScale(d)+14}, 13)`)
            .attr("x1", 0)
            .attr("x2", 0)
            .attr("y1", 0)
            .attr("y2", 6)
           
    }


    if (metaEvents) {
        const metaEventBase = getChildOrAppend<SVGGElement, SVGGElement>(contentBase, "g", "meta-event-base");
        getChildOrAppend<SVGLineElement, SVGGElement>(metaEventBase, "line", "meta-event-axis")
            .attr("x1", 0)
            .attr("x2", width)
            .attr("y1", 30)
            .attr("y2", 30);
    }

    const rowBases = _.range(0, events.length).map(id => getChildOrAppend<SVGGElement, SVGGElement>(contentBase, "g", `row-base-${id}`));
    rowBases.forEach((base, i) => base.attr("transform", `translate(0, ${rowHeight * i + (metaEvents ? 40 : 0)})`));
    rowBases.forEach((d, i) => {
        const node = d.node();
        if (node) {
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
                // selectedX: selectedX && selectedX[i],
                onMouseOver: onMouseOver && (() => onMouseOver(i)),
                // size: size,
                onMouseLeave: onMouseLeave && (() => onMouseLeave(i)),
                // calculateNewTime: calculateNewTime,
            })
        }
    })

    // getChildOrAppend<SVGRectElement, SVGGElement>(base, "rect", `base-rec`)
    //     .attr("width", width)
    //     .attr("height", rowHeight * events.length)
    //     .style("fill", "none");

    const subline = getChildOrAppend<SVGLineElement, SVGGElement>(base, "line", `subline`)
        .attr("y1", 0)
        .attr("y2", rowHeight * events.length)
        .style("display", `none`);

    base.on("mousemove", (event, d) => {
        subline.attr("x1", event.offsetX - 2)
            .attr("x2", event.offsetX - 2);
    });

    base.on("mouseover", () => {
        subline.style("display", `block`);
    });
    base.on("mouseleave", () => {
        subline.style("display", `none`);
    });
}
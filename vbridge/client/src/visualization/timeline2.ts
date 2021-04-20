import * as d3 from "d3"
import { EventGroup } from "data/event";
import { getChildOrAppend, getScaleLinear, getScaleTime, defaultCategoricalColor, IMargin, getMargin } from "./common";
import "./timeline2.css"

export interface VEventGroup extends EventGroup {
    track?: number,
}

export function drawTimeline2(params: {
    events: VEventGroup[],
    svg: SVGElement,

    width: number,
    height: number,
    trackHeight: number,
    trackMarginBottom: number,
    margin?: IMargin,
    timeScale?: d3.ScaleTime<number, number>,
    color?: string,
}) {
    const { color, events, svg, timeScale, trackHeight, trackMarginBottom } = params
    const root = d3.select(svg);
    const margin = getMargin(params.margin || {});
    const height = params.height - margin.top - margin.bottom;
    const width = params.width - margin.left - margin.right;

    const base = getChildOrAppend<SVGGElement, SVGElement>(root, "g", "base")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    const pointEventBase = getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "point-event-base");
    const intervalEventBase = getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "interval-event-base")
        .attr("transform", `translate(0, ${trackHeight + trackMarginBottom})`);

    const t = timeScale || getScaleTime(0, width, events.map(e => e.startTime).concat(events.map(e => e.endTime)));

    let pointEvents = events.filter(e => e.startTime.getTime() === e.endTime.getTime());
    let intervalEvents = events.filter(e => e.startTime.getTime() !== e.endTime.getTime());

    pointEventBase.selectAll(".point-event")
        .data(pointEvents)
        .join<SVGLineElement>(enter => {
            return enter.append("line")
                .attr("class", "point-event");
        }, update => update,
            exit => { exit.remove() })
        .attr("transform", d => `translate(${t(d.startTime)}, 0)`)
        .attr("y2", trackHeight)
        .style("stroke", color || defaultCategoricalColor(0));

    // intervalEvents = calculateTracks(intervalEvents);
    intervalEventBase.selectAll(".interval-event")
        .data(intervalEvents)
        .join<SVGRectElement>(enter => {
            return enter.append("rect")
                .attr("class", "interval-event")
        }, update => update,
            exit => { exit.remove() })
        .attr("x", d => t(d.startTime))
        .attr("width", d => t(d.endTime) - t(d.startTime))
        .attr("y", d => (d.track === undefined) ? 0 : (trackHeight + trackMarginBottom) * d.track)
        .attr("height", trackHeight)
        .style("fill", color || defaultCategoricalColor(0));

}

// Timeline layout wheel from http://bl.ocks.org/rengel-de/5603464
function compareAscending(item1: EventGroup, item2: EventGroup) {
    // Every item must have two fields: 'start' and 'end'.
    let result = item1.startTime.getTime() - item2.startTime.getTime();
    // earlier first
    if (result < 0) { return -1; }
    if (result > 0) { return 1; }
    // longer first
    result = item2.endTime.getTime() - item1.endTime.getTime();
    if (result < 0) { return -1; }
    if (result > 0) { return 1; }
    return 0;
}

function compareDescending(item1: EventGroup, item2: EventGroup) {
    // Every item must have two fields: 'start' and 'end'.
    var result = item1.startTime.getTime() - item2.startTime.getTime();
    // later first
    if (result < 0) { return 1; }
    if (result > 0) { return -1; }
    // shorter first
    result = item2.endTime.getTime() - item1.endTime.getTime();
    if (result < 0) { return 1; }
    if (result > 0) { return -1; }
    return 0;
}

export function calculateTracks(items: VEventGroup[],
    sortOrder?: "ascending" | "descending",
    timeOrder?: "forward" | "backward") {

    sortOrder = sortOrder || "descending"; // "ascending", "descending"
    timeOrder = timeOrder || "backward";   // "forward", "backward"
    const tracks: Date[] = [];

    function sortBackward() {
        // older items end deeper
        items.forEach(function (item) {
            for (var i = 0, track = 0; i < tracks.length; i++, track++) {
                if (item.endTime < tracks[i]) { break; }
            }
            item.track = track;
            tracks[track] = item.startTime;
        });
    }
    function sortForward() {
        // younger items end deeper
        items.forEach(function (item) {
            for (var i = 0, track = 0; i < tracks.length; i++, track++) {
                if (item.startTime > tracks[i]) { break; }
            }
            item.track = track;
            tracks[track] = item.endTime;
        });
    }

    if (sortOrder === "ascending")
        items.sort(compareAscending);
    else
        items.sort(compareDescending);

    if (timeOrder === "forward")
        sortForward();
    else
        sortBackward();

    return items;
}
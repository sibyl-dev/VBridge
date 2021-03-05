import * as d3 from "d3"
import { DataFrame } from "data-forge";
import { IEvent } from "data/event";
import * as _ from "lodash";
import { getChildOrAppend, getScaleLinear, getScaleTime, defaultCategoricalColor, IMargin, getMargin } from "./common";

import "./stackedAreaChart.css"

export type VEvents = {
    time: Date,
    count: number,
    accuCount: number
}

export function drawStackedAreaChart(params: {
    node: SVGElement | SVGGElement,
    width: number,
    height: number,
    margin?: IMargin,
    color?: (id: number) => string,
    timeScale: d3.ScaleTime<number, number>,
    events: IEvent[][],
    nbins?: number
}) {
    const { node, timeScale, events } = params
    const root = d3.select(node);
    const color = params.color || defaultCategoricalColor;
    const margin = getMargin(params.margin || {});
    const height = params.height - margin.top - margin.bottom;
    const width = params.width - margin.left - margin.right;

    const base = getChildOrAppend<SVGGElement, SVGElement>(root, "g", "base")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const nbins = params.nbins || 100;
    const startTime = timeScale.domain()[0].getTime();
    const endTime = timeScale.domain()[1].getTime();
    const timeDelta = (endTime - startTime) / nbins;
    const bins: VEvents[][] = _.range(0, events.length).map(() => _.range(0, nbins).map(binId => ({
        time: new Date(startTime + timeDelta * binId),
        count: 0,
        accuCount: 0,
    })));

    console.log(bins);

    for(let i = 0; i < events.length; i++) {
        if (i > 0) {
            _.range(0, nbins).forEach(binId => {
                const prevBin = bins[i-1][binId];
                bins[i][binId].accuCount = prevBin.count + prevBin.accuCount;
            })
        }
        events[i].forEach(event => {
            const binId = Math.max(0, Math.min(Math.floor((event.timestamp.getTime() - startTime) / timeDelta), nbins-1));
            bins[i][binId].count = bins[i][binId].count + event.count
        })
    }

    const counts: number[] = bins[bins.length-1].map(bin => bin.count + bin.accuCount);

    const y = getScaleLinear(0, height, counts);
    const area = d3.area<VEvents>()
        .x(d => timeScale(new Date(d.time)))
        .y0(d => height - y(d.accuCount))
        .y1(d => height - y(d.count + d.accuCount))
        .curve(d3.curveMonotoneX);

    base.selectAll(".stacked-area")
        .data(bins)
        .join(
            enter => enter.append("path")
                .attr("class", "stacked-area"),
            update => update,
            exit => exit.remove()
        )
        .attr("d", area)
        .style("fill", (d, i) => color(i))
}
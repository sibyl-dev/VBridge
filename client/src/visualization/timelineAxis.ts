import * as d3 from "d3"
import { IEvent } from "data/event";
import { getChildOrAppend, getScaleLinear, getScaleTime, defaultCategoricalColor, IMargin, getMargin } from "./common";
import { drawStackedAreaChart } from "./stackedAreaChart";

export function drawTimelineAxis(params: {
    svg: SVGElement,
    defaultTimeScale: d3.ScaleTime<number, number>,

    width: number,
    height: number,
    margin?: IMargin,
    color?: (id: number) => string,
    updateTimeScale?: (scale: d3.ScaleTime<number, number>, startDate:Date, endDate:Date) => void,

    drawAreaChart?: boolean,
    events?: IEvent[][],
    size?: number,
}) {
    const { svg, defaultTimeScale, updateTimeScale, drawAreaChart, events, color,size } = params
    const root = d3.select(svg);
    const margin = getMargin(params.margin || {});
    const height = params.height - margin.top - margin.bottom;
    const width = params.width - margin.left - margin.right;
    console.log('drawTimelineAxis', height, width, margin, svg)

    let focusedTimeScale = d3.scaleTime().range([0, width]).domain(defaultTimeScale.domain());

    const base = getChildOrAppend<SVGGElement, SVGElement>(root, "g", "base")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    const focusedAxisbase = getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "short-axis-base");
    const areaChartbase = getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "area-chart-base")
        .attr("transform", `translate(0, 20)`);
    const defaultAxisbase = getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "long-axis-base")
        .attr("transform", `translate(0, ${height})`);
    const band = getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "brush-base")
        .attr("transform", `translate(0, ${height})`);

    const brush = d3.brushX()
        .extent([[0, -10], [width, 10]])
        .on("brush", brushed);

    band.call(brush)
        .on("click", brushed);

    function brushed(event: { selection: [number, number] }) {
        const { selection } = event;
        let extent = []
        let choseInterval = 0

        if (selection) {
            extent = selection.map(defaultTimeScale.invert);
            let mins =  Math.round((extent[1].valueOf() - extent[0].valueOf())/1000/60)
            if(15 * 9 >= mins) {
                let startMins =  Math.floor(extent[0].valueOf()/1000/60)
                extent[0] = new Date((startMins - startMins%15)*1000*60)
                let endMins =  Math.ceil(extent[1].valueOf()/1000/60)
                extent[1] = new Date((endMins - endMins%15+15)*1000*60)
                choseInterval = 15
            }
            else if(30 * 9 >= mins){
                let startMins =  Math.floor(extent[0].valueOf()/1000/60)
                extent[0] = new Date((startMins - startMins%30)*1000*60)
                let endMins =  Math.ceil(extent[1].valueOf()/1000/60)
                extent[1] = new Date((endMins - endMins%30+30)*1000*60)
                choseInterval = 30
            }
            else{
                let size=6
                const ONE_HOUR = 60
                const ONE_MIN = 1
                const definedIntervalMins = [15*ONE_MIN, 30*ONE_MIN, ONE_HOUR, 2*ONE_HOUR, 4*ONE_HOUR, 6*ONE_HOUR, 12*ONE_HOUR, 24*ONE_HOUR]

                for(let i=definedIntervalMins.length; i>=0; i--){
                    for(size = 7; size<=9; size++){
                        if(definedIntervalMins[i]*size>=mins){
                            choseInterval = definedIntervalMins[i]
                            break
                        }
                        if(choseInterval)
                            break
                    }
                }
                if(choseInterval==0) choseInterval= Math.round(mins/60/8)*ONE_HOUR
                let hrs = Math.floor(extent[0]!.valueOf()/1000/60/60)
                extent[0] = new Date((hrs - hrs%(size!/60) - 8)*1000*60*60)!
                hrs = Math.ceil(extent[1]!.valueOf()/1000/60/60)
                extent[1] = new Date((hrs - hrs%(size!/60) - 8 + size!/60)*1000*60*60)!
                // extent[0] = new Date(Math.floor(extent[0].valueOf()/1000/60/60)*1000*60*60)
                // extent[1] = new Date(Math.ceil(extent[1].valueOf()/1000/60/60)*1000*60*60)
            }
        }
        else {
            extent = defaultTimeScale.domain();
        }
        // focusedTimeScale.domain(extent);
        focusedTimeScale = d3.scaleTime().range([0, width]).domain(extent);
        updateAxis(extent, choseInterval);
    }

    let longAxis = d3.axisBottom(defaultTimeScale).ticks(d3.timeHour.every(size!/60));
    if(size!/60<1){
        longAxis = d3.axisBottom(focusedTimeScale).ticks(d3.timeMinute.every(size!));
    }
    defaultAxisbase.call(longAxis);
    console.log('drawTimelineAxis size', size, size!/60)

    function updateAxis(extent: Date[], choseInterval: number) {
        shortAxis = d3.axisBottom(focusedTimeScale).ticks(d3.timeHour.every(choseInterval!/60));
        if(choseInterval!/60<1){
            shortAxis = d3.axisBottom(focusedTimeScale).ticks(d3.timeMinute.every(choseInterval!));
        }
         console.log('updateAxis shortAxis size', choseInterval, choseInterval!/60)

        focusedAxisbase.call(shortAxis);
        updateTimeScale && extent && updateTimeScale(focusedTimeScale, extent[0], extent[1]);
    }

    let shortAxis = d3.axisBottom(focusedTimeScale).ticks(d3.timeHour.every(size!/60));
    if(size!/60<1){
        shortAxis = d3.axisBottom(focusedTimeScale).ticks(d3.timeMinute.every(size!));
    }
    console.log('shortAxis', size, size!/60)

    focusedAxisbase.call(shortAxis);

    const areaChartNode = areaChartbase.node();
    if (drawAreaChart && areaChartNode && events) {
        drawStackedAreaChart({
            node: areaChartNode,
            timeScale: defaultTimeScale,
            width: width,
            height: height - 20,
            margin: {top: 0, bottom: 0, left: 0, right: 0},
            color: color,
            events: events
        })
    }
}
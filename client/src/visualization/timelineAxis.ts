import * as d3 from "d3"
import { IEvent } from "data/event";
import { getChildOrAppend, getScaleLinear, getScaleTime, defaultCategoricalColor, IMargin, getMargin, calIntervalsCommon } from "./common";
import { drawStackedAreaChart } from "./stackedAreaChart";


export function drawTimelineAxis(params: {
    svg: SVGElement,
    defaultTimeScale: d3.ScaleTime<number, number>,

    width: number,
    height: number,
    margin?: IMargin,
    color?: (id: number) => string,
    updateTimeScale?: (scale: d3.ScaleTime<number, number>, startDate:Date, endDate:Date) => void,
    formulateStartandEnd?:( startDate: Date, endDate: Date) => Date[],


    drawAreaChart?: boolean,
    events?: IEvent[][],
    size?: number,
}) {
    const { svg, defaultTimeScale, updateTimeScale, drawAreaChart, events, color,size, formulateStartandEnd } = params
    const root = d3.select(svg);
    const margin = getMargin(params.margin || {});
    const height = params.height - margin.top - margin.bottom;
    const width = params.width - margin.left - margin.right;
    // console.log('drawTimelineAxis', height, width, margin, svg)

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

        if (selection && formulateStartandEnd) {
            extent = selection.map(defaultTimeScale.invert);
            console.log('timelineAxis selection', extent )

            let mins =  Math.round((extent[1].valueOf() - extent[0].valueOf())/1000/60)
            
          
            choseInterval = calIntervalsCommon(extent[0], extent[1])
             if(choseInterval && choseInterval<60){
                let mins = Math.floor(extent[0].valueOf()/1000/60)
                extent[0] =  new Date((mins - mins%choseInterval)*1000*60)!
                mins = Math.floor(extent[1].valueOf()/1000/60)
                extent[1] =  new Date((mins - mins%choseInterval)*1000*60)!
            }
            else{ 
                // need to minus 8 hours since GMT8:00
                let hrs = Math.floor(extent[0]!.valueOf()/1000/60/60)
                extent[0] = new Date((hrs - (hrs+8)%(choseInterval!/60))*1000*60*60)!
                hrs = Math.floor(extent[1]!.valueOf()/1000/60/60)
                extent[1] = new Date((hrs - (hrs+8)%(choseInterval!/60)+ choseInterval!/60)*1000*60*60)!
            }
            
        }
        else {
            extent = defaultTimeScale.domain();
        }
        // console.log('timelineAxis selection after',  choseInterval, choseInterval/60,extent )

        // focusedTimeScale.domain(extent);
        focusedTimeScale = d3.scaleTime().range([0, width]).domain(extent);
        updateAxis(extent, choseInterval);
    }

    let longAxis = d3.axisBottom(defaultTimeScale).ticks(d3.timeHour.every(size!/60));
    if(size!/60<1){
        longAxis = d3.axisBottom(defaultTimeScale).ticks(d3.timeMinute.every(size!));
    }
    if(size!/60/24>1){
        longAxis = d3.axisBottom(defaultTimeScale).ticks(d3.timeDay.every(size!/60/24));
    }
    if(size!/60/24>15){
        longAxis = d3.axisBottom(defaultTimeScale).ticks(d3.timeMonth.every(1));
    }
    defaultAxisbase.call(longAxis);
    // console.log('drawTimelineAxis size', size, size!/60)

    function updateAxis(extent: Date[], choseInterval: number) {
        shortAxis = d3.axisBottom(focusedTimeScale).ticks(d3.timeHour.every(choseInterval!/60));
        if(choseInterval!/60<1){
            shortAxis = d3.axisBottom(focusedTimeScale).ticks(d3.timeMinute.every(choseInterval!));
        }
        if(choseInterval!/60/24>1){
            shortAxis = d3.axisBottom(focusedTimeScale).ticks(d3.timeDay.every(choseInterval!/60/24));
        }
        if(choseInterval!/60/24>15){
            shortAxis = d3.axisBottom(focusedTimeScale).ticks(d3.timeMonth.every(1));
        }
         console.log('updateAxis shortAxis size', choseInterval, choseInterval!/60)

        focusedAxisbase.call(shortAxis);
        updateTimeScale && extent && updateTimeScale(focusedTimeScale, extent[0], extent[1]);
    }

    let shortAxis = d3.axisBottom(focusedTimeScale).ticks(d3.timeHour.every(size!/60));
    if(size!/60<1){
        shortAxis = d3.axisBottom(focusedTimeScale).ticks(d3.timeMinute.every(size!));
    }
    if(size!/60/24>1){
        shortAxis = d3.axisBottom(focusedTimeScale).ticks(d3.timeDay.every(size!/60/24));
    }
    if(size!/60/24>15){
        shortAxis = d3.axisBottom(focusedTimeScale).ticks(d3.timeMonth.every(1));
    }
    // console.log('shortAxis', size, size!/60)

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
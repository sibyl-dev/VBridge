import * as d3 from "d3";
import * as _ from "lodash";
// import {scaleOrdinal, scaleLinear} from 'd3-scale';
import * as React from "react";
import {
    getMargin,
    CSSPropertiesFn,
    ChartOptions,
    getChildOrAppend,
    getScaleLinear,
    MarginType,
    IMargin
} from "./common";
import { shallowCompare, number2string, transMax } from '../data/common';
import { defaultCategoricalColor } from './common';
import "./Histogram.scss";
import { start } from "node:repl";

function isArrays<T>(a: T[] | T[][]): a is T[][] {
    return a.length > 0 && Array.isArray(a[0]);
}

export interface IHistogramOptions extends ChartOptions {
    innerPadding?: number;
    drawLeftAxis?: boolean,
    drawBottomAxis?: boolean,
    areaChart?: boolean,
    binColor?: (x: number) => string,
    rectStyle?: CSSPropertiesFn<SVGRectElement, d3.Bin<number, number>>;
    onRectMouseOver?: d3.ValueFn<any, d3.Bin<number, number>, void>;
    // onRectMouseMove?: d3.ValueFn<any, d3.Bin<number, number>, void>;
    onRectMouseLeave?: d3.ValueFn<any, d3.Bin<number, number>, void>;
    onSelectRange?: (range?: [number, number]) => any;
    xScale?: d3.ScaleLinear<number, number>;
    yScale?: d3.ScaleLinear<number, number>;
    ticks?: number[];
    selectedRange?: [number, number];
    nBinsMin?: number,
    nBinsMax?: number,
    barWidthMin?: number,
    barWidthMax?: number
}

export const defaultOptions = {
    width: 300,
    height: 200,
    margin: 0,
    innerPadding: 1,
    drawAxis: false,
    drawBottomAxis: true,
};

export function getNBinsRange(width: number, minWidth: number = 7, maxWidth: number = 9): [number, number] {
    return [Math.ceil(width / maxWidth), Math.floor(width / minWidth)];
}

export type IHistogramProps = (IHistogramOptions | IGHistogramOptions) & {
    data: number[] | number[][];
    allData?: number[] | number[][];
    dmcData?: number[] | number[][];
    referenceValue?: number,
    whatIfValue?: number,
    style?: React.CSSProperties;
    svgStyle?: React.CSSProperties;
    className?: string;
    extent?: [number, number];
    drawRange?: boolean;
    mode?: 'side-by-side' | 'stacked';
    onHoverRange?: (range?: [number, number]) => any;
}

const defaultProps = {
    ...defaultOptions,
    drawLeftAxis: false,
    drawBottomAxis: true,
    drawRange: false
}

export interface IHistogramState {
    hoveredBin: [number, number] | null;
}

export default class Histogram extends React.PureComponent<
    IHistogramProps,
    IHistogramState
> {
    static defaultProps = { ...defaultProps };
    private svgRef: React.RefObject<SVGSVGElement> = React.createRef();
    private shouldPaint: boolean = false;

    constructor(props: IHistogramProps) {
        super(props);

        this.state = { hoveredBin: null };
        this.paint = this.paint.bind(this);
        this.onMouseOverBin = this.onMouseOverBin.bind(this);
        this.onMouseOverBins = this.onMouseOverBins.bind(this);
        this.onMouseLeaveBin = this.onMouseLeaveBin.bind(this);
        this.onMouseLeaveBins = this.onMouseLeaveBins.bind(this);

        this.onHoverRange = this.onHoverRange.bind(this);
    }

    public paint(svg: SVGSVGElement | null = this.svgRef.current) {
        if (svg) {
            console.debug("paint histogram");
            const { data, allData, dmcData, className, style, svgStyle, height, drawRange, referenceValue, whatIfValue, ...rest } = this.props;
            const xScale = rest.xScale || this.getXScale();
            const chartHeight = drawRange ? (height - 24) : (height - 4);
            drawGroupedHistogram({
                root: svg, data, allData, dmcData, referenceValue, whatIfValue,
                options: {
                    height: chartHeight,
                    ...rest,
                    xScale,
                    onRectMouseOver: this.onMouseOverBins,
                    onRectMouseLeave: this.onMouseLeaveBins,
                    onHoverRange: this.onHoverRange,
                    innerPadding: 0,
                }
            });

            this.shouldPaint = false;
        }
    }

    public componentDidMount() {
        this.paint();
    }

    public componentDidUpdate(
        prevProps: IHistogramProps,
        prevState: IHistogramState
    ) {
        const excludedProperties = new Set(["style", "svgStyle", "className"]);
        // const excludedState = new Set(["hoveredBin"]);
        if (!shallowCompare(this.props, prevProps, excludedProperties, true)) {
            this.shouldPaint = true;
            const delayedPaint = () => {
                if (this.shouldPaint) this.paint();
            };
            window.setTimeout(delayedPaint, 100);
        }
    }

    getXScale = () => {
        const { data, width } = this.props;
        const margin = getMargin(this.props.margin);
        return getScaleLinear(0, width - margin.left - margin.right, isArrays(data) ? _.flatten(data) : data);
    };

    public render() {
        const { style, svgStyle, className, width, height, drawRange, extent } = this.props;
        const { hoveredBin } = this.state;
        return (
            <div className={(className || "") + " histogram"} style={style}>
                <svg
                    ref={this.svgRef}
                    style={{ ...svgStyle }}
                    width={width}
                    height={drawRange ? (height - 20) : height}
                />
                {drawRange && <div className="info">
                    {hoveredBin
                        ? `${number2string(hoveredBin[0])} - ${number2string(hoveredBin[1])}`
                        : (extent && `${number2string(extent[0], 3)} - ${number2string(extent[1], 3)}`)
                    }
                </div>}

            </div>
        );
    }

    onHoverRange(range: [number, number]) {
        const { onHoverRange } = this.props;
        onHoverRange && onHoverRange(range);
        // this.setState({hoveredBin: range});
    }

    onMouseOverBin: d3.ValueFn<any, d3.Bin<number, number>, void> = (
        data,
        index,
        groups
    ) => {
        const { x0, x1 } = data;
        const hoveredBin: [number, number] = [
            x0 === undefined ? -Infinity : x0,
            x1 === undefined ? Infinity : x1
        ];
        const { onHoverRange } = this.props;
        onHoverRange && onHoverRange(hoveredBin);
        this.setState({ hoveredBin });
    };

    onMouseOverBins: d3.ValueFn<any, d3.Bin<number, number>[], void> = (
        data,
        index
    ) => {
        const { x0, x1 } = data[0];
        const hoveredBin: [number, number] = [
            x0 === undefined ? -Infinity : x0,
            x1 === undefined ? Infinity : x1
        ];
        const { onHoverRange } = this.props;
        onHoverRange && onHoverRange(hoveredBin);
        this.setState({ hoveredBin });
    };

    onMouseLeaveBin: d3.ValueFn<any, d3.Bin<number, number>, void> = (
        data,
        index
    ) => {
        this.props.onHoverRange && this.props.onHoverRange();
        this.setState({ hoveredBin: null });
    };

    onMouseLeaveBins: d3.ValueFn<any, d3.Bin<number, number>[], void> = (
        data,
        index
    ) => {
        this.props.onHoverRange && this.props.onHoverRange();
        this.setState({ hoveredBin: null });
    };
}

export type IGHistogramOptions = Omit<IHistogramOptions, "onRectMouseOver" | "onRectMouseMove" | "onRectMouseLeave"> & {
    key: string,
    onRectMouseOver?: d3.ValueFn<any, d3.Bin<number, number>[], void>;
    // onRectMouseMove: d3.ValueFn<any, d3.Bin<number, number>[], void>;
    onRectMouseLeave?: d3.ValueFn<any, d3.Bin<number, number>[], void>;
    onHoverRange: (range: [number, number]) => void;
    color?: (x: number) => string;
    mode?: "side-by-side" | "stacked",
    rangeSelector?: "bin-wise" | "as-a-whole" | "none",
    direction?: "up" | "down",
    snapping?: boolean,
    drawBand?: boolean,
    bandValueFn?: (x: number) => number,
    // bandColor?: 
    twisty?: number,
}

export function drawGroupedHistogram(param: {
    root: SVGElement | SVGGElement,
    data: number[] | number[][],
    allData?: number[] | number[][],
    dmcData?: number[] | number[][],
    referenceValue?: number,
    whatIfValue?: number,
    options?: Partial<IGHistogramOptions>
}
) {
    const { root, data, allData, dmcData, options, referenceValue, whatIfValue } = param;
    const opts = { ...defaultOptions, ...options };
    const {
        width,
        height,
        rectStyle,
        binColor,
        innerPadding,
        onRectMouseOver,
        // onRectMouseMove,
        onRectMouseLeave,
        onSelectRange,
        onHoverRange,
        xScale,
        yScale,
        ticks,
        selectedRange,
        rangeSelector,
        direction,
        drawLeftAxis: drawAxis,
        drawBottomAxis,
        drawBand,
        bandValueFn,
        key,
        snapping,
        twisty,
        areaChart
    } = opts;
    const mode = opts.mode ? opts.mode : "side-by-side";
    const nGroups = data.length;
    if (nGroups == 0) throw "data length equals to 0";
    const binPad = 1;

    const margin = getMargin(opts.margin);
    const color = opts.color || defaultCategoricalColor;

    const layout = new HistogramLayout({
        data: data,
        mode: mode,
        width: width,
        height: height,
        margin: margin,
        dmcData: dmcData || allData || data,
        xScale: xScale,
        yScale: yScale,
        ticks: ticks,
        innerPadding: innerPadding,
        direction: direction
    });

    const bins = layout.layout;

    const allDataLayout = allData ? new HistogramLayout({
        data: allData,
        mode: mode,
        width: width,
        height: height,
        margin: margin,
        dmcData: dmcData || allData,
        xScale: xScale,
        yScale: yScale,
        ticks: ticks,
        innerPadding: innerPadding,
        direction: direction
    }) : undefined;

    const allBins = allDataLayout && allDataLayout.layout;
    const xRange = layout.xRange;
    const yRange = layout.yRange;

    const _root = d3.select(root);

    // Render the base histogram (with all data)
    const base = getChildOrAppend<SVGGElement, SVGElement>(
        _root,
        "g",
        "base"
    ).attr(
        "transform",
        `translate(${margin.left}, ${margin.top})`
    )

    const baseGs = base.selectAll<SVGGElement, BarLayout[]>("g.groups")
        .data(allBins || [])
        .join<SVGGElement>(enter => {
            return enter
                .append("g")
                .attr("class", "groups");
        })
        .attr("fill", (d, i) => color(i));

    baseGs
        .selectAll<SVGRectElement, BarLayout>("rect.bar")
        .data(d => d)
        .join<SVGRectElement>(enter => {
            return enter
                .append("rect")
                .attr("class", "bar");
        })
        .attr("transform", (d, i) => `translate(${d.x}, ${d.y})`)
        .attr("width", d => d.width)
        .attr("height", d => d.height);

    // Render the current histogram (with filtered data)

    const current = getChildOrAppend<SVGGElement, SVGElement>(_root, "g", "current")
        .attr(
            "transform",
            `translate(${margin.left}, ${margin.top})`
        )

    if (areaChart) {
        const area = d3.area<BarLayout>()
            .x(d => d.x)
            .y0(d => d.y)
            .y1(d => d.y + d.height)
            .curve(d3.curveMonotoneX);
        const gs = current.selectAll<SVGGElement, BarLayout[]>("path.area")
            .data(bins)
            .join(enter => {
                return enter
                    .append("path")
                    .attr("class", "area");
            })
            .attr("fill", (d, i) => color(i))
            .attr("d", d => area(d));
    }
    else {
        const gs = current.selectAll<SVGGElement, BarLayout[]>("g.groups")
            .data(bins)
            .join<SVGGElement>(enter => {
                return enter
                    .append("g")
                    .attr("class", "groups");
            })
            .attr("fill", (d, i) => color(i));
        const merged = gs
            .selectAll("rect.bar")
            .data(d => d)
            .join<SVGRectElement>(enter => {
                return enter
                    .append("rect")
                    .attr("class", "bar");
            })
            .attr("transform", (d, i) => `translate(${d.x}, ${d.y})`)
            .attr("width", d => d.width)
            .attr("height", d => d.height)
        // .append("title")
        // .text(d => d.length);
        if (binColor) {
            // merged.attr("fill", d => binColor(xScale?.invert(d.x || 0)!))
            merged.attr("fill", d => {
                const startColor = binColor(xScale?.invert(d.x || 0)!);
                const endColor = binColor(xScale?.invert(d.x + d.width || 0)!);
                if (startColor === endColor)
                    return startColor
                else
                    return '#fff'
            });
        }

        if (rectStyle) {
            Object.keys(rectStyle).forEach(key => {
                merged.style(
                    key,
                    (rectStyle[key as keyof typeof rectStyle] || null) as null
                );
            });
        }
    }


    referenceValue && xScale && getChildOrAppend<SVGLineElement, SVGGElement>(base, "line", "reference-line")
        .attr("x1", xScale(referenceValue))
        .attr("x2", xScale(referenceValue))
        .attr("y1", 0)
        .attr("y2", yRange[1])

    // referenceValue && xScale && getChildOrAppend<SVGTextElement, SVGGElement>(base, "text", "reference-line-text")
    //     .attr("x", xScale(referenceValue))
    //     .attr("y", yRange[1])
    //     .attr("dy", 10)
    //     .attr("dx", -10)
    //     .text(referenceValue)
    // .append("title")
    // .text(referenceValue.toFixed(2));

    xScale && getChildOrAppend<SVGLineElement, SVGGElement>(base, "line", "reference-line-whatif")
        .attr("x1", xScale(whatIfValue || 0))
        .attr("x2", xScale(whatIfValue || 0))
        .attr("y1", 0)
        .attr("y2", yRange[1])
        .style("display", (whatIfValue !== undefined) ? 'block' : 'none')
    // .append("title")
    // .text((whatIfValue || 0).toFixed(2));

    // referenceValue && xScale && getChildOrAppend<SVGTextElement, SVGGElement>(base, "text", "reference-text")
    //     .attr("transform", `translate(${xScale(referenceValue)}, 0)`)
    //     .attr("dy", 8)
    //     .attr("dx", 2)
    //     .text(referenceValue.toFixed(2));

    const yreverse = d3.scaleLinear().domain(layout.y.domain()).range([layout.y.range()[1], layout.y.range()[0]])

    if (drawAxis) {
        base.call(d3.axisLeft(yreverse).ticks(4));
    }

    xScale && getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "x-axis-base")
        .attr("transform", `translate(0, ${yRange[1]})`)
        .attr("display", drawBottomAxis ? 'block' : 'none')
        .call(d3.axisBottom(xScale).ticks(5));

    // Render the shades for highlighting selected regions
    if (rangeSelector === 'bin-wise') {
        let rangeBrushing: [number, number] | null = null;
        if (selectedRange) {
            const startIndex = bins[0].findIndex(
                ({ x1 }) => x1 !== undefined && selectedRange[0] < x1
            );
            const endIndex = _.findLastIndex(
                bins[0],
                ({ x0 }) => x0 !== undefined && x0 < selectedRange[1]
            );
            rangeBrushing = [startIndex, endIndex];
        }
        // console.debug("brushed Range", rangeBrushing);
        let brushing: boolean = false;

        const gShades = getChildOrAppend<SVGGElement, SVGElement>(
            _root,
            "g",
            "shades"
        ).attr(
            "transform",
            `translate(${margin.left}, ${margin.top})`
        )

        const renderShades = () => {
            return gShades
                .selectAll("rect.shade")
                .data(bins[0])
                .join<SVGRectElement>(enter => {
                    return enter
                        .append("rect")
                        .attr("class", "shade")
                        .attr("y", yRange[0]);
                })
                .attr("x", (d, i) => d.x)
                .attr("width", d => layout.x(d.x1 as number) - layout.x(d.x0 as number))
                .attr("height", yRange[1])
                .classed("show", (d, idx) =>
                    rangeBrushing
                        ? Math.min(...rangeBrushing) <= idx &&
                        idx <= Math.max(...rangeBrushing)
                        : false
                );
        };

        const merged2 = renderShades();
        merged2
            .on("mouseover", (event, d) => {
                // onRectMouseOver && onRectMouseOver(bins.map(bs => bs[idx]), idx, groups);
                if (brushing && rangeBrushing) {
                    const idx = _.findIndex(bins[0], bin => bin.x == d.x);
                    rangeBrushing[1] = idx;
                    renderShades();
                }
            })
            // .on("mousemove", (onRectMouseMove || null) as null)
            .on("mouseleave", (onRectMouseLeave || null) as null);

        merged2
            .on("mousedown", function (event, d) {
                brushing = true;
                const idx = _.findIndex(bins[0], bin => bin.x == d.x);
                if (rangeBrushing === null) rangeBrushing = [idx, idx];
                else rangeBrushing = null;
                console.debug("brushing start", rangeBrushing);
                event.stopPropagation();
            })
            .on("mouseup", function (event, d) {
                if (rangeBrushing) {
                    const idx = _.findIndex(bins[0], bin => bin.x == d.x);
                    rangeBrushing[1] = idx;
                    const x0 = bins[0][Math.min(...rangeBrushing)].x0,
                        x1 = bins[0][Math.max(...rangeBrushing)].x1;
                    console.log("select range:", x0, x1, d3.max(_.flatten(data)));
                    onSelectRange && onSelectRange([x0 as number, x1 as number]);
                } else {
                    onSelectRange && onSelectRange();
                }
                brushing = false;
                renderShades();
                console.debug("brushing end");
            });
    }
    else if (rangeSelector === 'as-a-whole') {
        const selectorBase = getChildOrAppend<SVGGElement, SVGElement>(_root, "g", "selector-base")
            .attr(
                "transform",
                `translate(${margin.left}, ${margin.top})`
            );

        const selectorSheet = getChildOrAppend<SVGRectElement, SVGGElement>(selectorBase, "rect", "selector-sheet")
            .attr("x", xRange[0])
            .attr("y", xRange[0])
            .attr("width", xRange[1] - xRange[0])
            .attr("height", yRange[1] - yRange[0])

        let _selectedRange: [number, number] = selectedRange ? [layout.x(selectedRange[0]), layout.x(selectedRange[1])] : [0, 0];
        let handling: 'left' | 'right' = 'left';

        const updateSelectorBox = (range: [number, number]) => {

            return getChildOrAppend(selectorBase, "rect", "selector")
                .attr("x", Math.min(range[1], range[0]))
                .attr("y", yRange[0])
                .attr("width", Math.abs(range[1] - range[0]))
                .attr("height", yRange[1] - yRange[0])
                .style("fill", d3.interpolateReds(twisty ? twisty : 0))
            // .on("click", () => updateSelectorBox([0, 0])); 
        }

        updateSelectorBox(_selectedRange);
    }
}

interface HistogramLayoutProps extends ChartOptions {
    data: number[] | number[][],
    mode: 'side-by-side' | 'stacked',
    dmcData?: number[] | number[][],
    innerPadding?: number,
    groupInnerPadding?: number,
    xScale?: d3.ScaleLinear<number, number>,
    yScale?: d3.ScaleLinear<number, number>,
    ticks?: number[],
    direction?: 'up' | 'down',
}

interface BarLayout extends d3.Bin<number, number> {
    x: number,
    y: number,
    width: number,
    height: number,
}

export class HistogramLayout {
    private _data: number[][];
    private _dmcData: number[][];
    private _mode: 'side-by-side' | 'stacked';
    private _width: number;
    private _height: number;
    private _margin: IMargin;
    private _innerPadding: number;
    private _groupInnerPadding: number;
    private _xScale: d3.ScaleLinear<number, number>;
    private _yScale: d3.ScaleLinear<number, number>;
    private _ticks: number[];
    private _direction: 'up' | 'down';

    constructor(props: HistogramLayoutProps) {
        const { data, dmcData, mode, width, height, innerPadding, groupInnerPadding, xScale, margin, yScale, ticks, direction } = props;
        this._data = isArrays(data) ? data : [data];
        this._dmcData = dmcData ? (isArrays(dmcData) ? dmcData : [dmcData]) : this._data;
        this._mode = mode;
        // this._mode = 'side-by-side';
        this._width = width;
        this._height = height;
        this._margin = getMargin(margin);
        this._direction = direction ? direction : 'up';
        this._innerPadding = innerPadding ? innerPadding : 1;
        this._groupInnerPadding = groupInnerPadding ? groupInnerPadding : (this._data.length === 1 ? 0 : 0);

        this._xScale = this.getXScale(xScale);
        const [min, max] = mode === 'side-by-side' ? getNBinsRange(width, 10, 16) : getNBinsRange(width, 7, 9);
        const tickNum = Math.min(max, Math.max(min, d3.thresholdSturges(_.flatten(this._dmcData))))
        this._ticks = ticks ? ticks : this.x.ticks(tickNum);
        // console.log(this._ticks, this.x.domain());
        const interval = (this.x.domain()[1] - this.x.domain()[0]) / (tickNum + 1)
        this._xScale.domain([this._ticks[0] - interval, this._ticks[this._ticks.length-1] + interval])
        this._yScale = this.getYScales(yScale);
    }

    private getXScale(xScale?: d3.ScaleLinear<number, number>): d3.ScaleLinear<number, number> {
        return xScale ? xScale : getScaleLinear(this.xRange[0], this.xRange[1], _.flatten(this._dmcData));
        // return getScaleLinear(_.flatten(this._dmcData), ...this.xRange);
    }

    private getYScales(yScale?: d3.ScaleLinear<number, number>):
        d3.ScaleLinear<number, number> {
        console.log(this._ticks.map(d => this.x(d)));
        const histogram = d3
            .bin()
            .domain(this.x.domain() as [number, number])
            .thresholds(this._ticks);

        const dmcBins = this._dmcData.map(d => histogram(d));
        // const dmcBins = this.gBins;
        const yMax = this._mode === 'side-by-side' ? d3.max(dmcBins, function (bs) {
            return d3.max(bs, d => d.length);
        }) : d3.max(transMax(dmcBins), function (bs) {
            return d3.sum(bs, d => d.length);
        });
        if (yMax === undefined) throw "Invalid bins";
        const _yScale = yScale ? yScale : d3.scaleLinear().range(this.yRange).domain([0, yMax]);
        return _yScale;
    }

    public get xRange(): [number, number] {
        return [0, this._width - this._margin.left - this._margin.right]
    }

    public get yRange(): [number, number] {
        return [0, this._height - this._margin.bottom - this._margin.top];
    }

    public get x(): d3.ScaleLinear<number, number> {
        return this._xScale;
    }

    public get y(): d3.ScaleLinear<number, number> {
        return this._yScale;
    }

    public get gBins(): d3.Bin<number, number>[][] {
        const histogram = d3
            .bin()
            .domain(this.x.domain() as [number, number])
            .thresholds(this._ticks);
        return this._data.map(d => histogram(d));
    }

    public xScale(newx: d3.ScaleLinear<number, number>) {
        this._xScale = newx;
        return this;
    }

    public yScale(newy: d3.ScaleLinear<number, number>) {
        this._yScale = newy;
        return this;
    }

    public get ticks() {
        return this._ticks;
    }

    public get groupedBarWidth() {
        const nBins = this.gBins[0].length;
        return (this.xRange[1] - this.xRange[0]) / nBins;
    }

    public get barWidth() {
        const nGroups = this.gBins.length;
        const groupedBarWidth = this.groupedBarWidth - this._innerPadding;
        return Math.max(this._mode === 'side-by-side' ? (groupedBarWidth / nGroups - this._groupInnerPadding) : groupedBarWidth, 1)
    }

    public get layout(): BarLayout[][] {
        const gBins = this.gBins;
        const nGroups = gBins.length;
        const nBins = gBins[0].length;

        const barWidth = this.barWidth;
        const dx: number[][] = _.range(nGroups).map((d, i) => _.range(nBins).map(() => this._mode === 'side-by-side' ? i * (barWidth + this._groupInnerPadding) : 0));
        const dy: number[][] = _.range(nGroups).map((d, groupId) => _.range(nBins).map((d, binId) => this._mode === 'side-by-side' ? 0 :
            this.y(d3.sum(
                gBins.map(bins => bins[binId].length).filter((d, i) => i < groupId)
            )) + (groupId > 0 ? this.yRange[0] : 0)
        ));

        return this.gBins.map((bins, groupId) => bins.map((bin, binId) => {
            const Layout: BarLayout = {
                ...bin,
                x: this.x(bin.x0 as number) + dx[groupId][binId],
                y: this._direction === 'up' ? (this.yRange[1] - dy[groupId][binId] - this.y(bin.length)) : dy[groupId][binId],
                width: barWidth,
                height: this.y(bin.length) - this.y(0),
            } as BarLayout;
            return Layout;
        }))
    }
}
import * as d3 from "d3";
import * as _ from "lodash";
import { getScaleLinear, isArrays } from "./common";
import { transMax } from '../data/common';

export interface HistogramLayoutStyle {
    height: number,
    width: number,
    mode: 'normal' | 'side-by-side' | 'stacked',
    direction: 'up' | 'down',
    innerPadding: number,
    groupInnerPadding: number,
    xScale?: d3.ScaleLinear<number, number>,
    yScale?: d3.ScaleLinear<number, number>,
    ticks?: number[],
}

const defaultHistogramLayoutStyle: HistogramLayoutStyle = {
    height: 60,
    width: 100,
    mode: 'side-by-side',
    direction: 'up',
    innerPadding: 1,
    groupInnerPadding: 0,
}

export interface HistogramLayoutProps extends Partial<HistogramLayoutStyle> {
    data: number[] | number[][],
}

export interface BarLayout extends d3.Bin<number, number> {
    x: number,
    y: number,
    width: number,
    height: number,
}

export default class HistogramLayout {
    private _data: number[][];
    private _style: HistogramLayoutStyle;
    private _histogram: d3.HistogramGeneratorNumber<number, number>;
    private _bins: d3.Bin<number, number>[][];

    constructor(props: HistogramLayoutProps) {
        const { data } = props;
        this._data = isArrays(data) ? data : [data];
        this._style = { ...defaultHistogramLayoutStyle, ...props };

        if (this._style.xScale === undefined) this._style.xScale = this.getXScale();
        if (this._style.ticks === undefined) this._style.ticks = this.getTicks();

        this._histogram = d3.bin()
            .domain(this.x.domain() as [number, number])
            .thresholds(this._style.ticks!);
        this._bins = this._data.map(d => this._histogram(d));

        if (this._style.yScale === undefined) this._style.yScale = this.getYScales();
    }

    static getNBinsRange(width: number, minWidth: number = 7, maxWidth: number = 9): [number, number] {
        return [Math.ceil(width / maxWidth), Math.floor(width / minWidth)];
    }

    private getXScale(): d3.ScaleLinear<number, number> {
        return getScaleLinear(this.xRange[0], this.xRange[1], _.flatten(this._data));
    }

    private getTicks() {
        // const { mode, width } = this._style;
        // const [min, max] = mode === 'side-by-side' ?
        //     HistogramLayout.getNBinsRange(width, 10, 16) :
        //     HistogramLayout.getNBinsRange(width, 7, 9);
        // const tickNum = Math.min(max, Math.max(min, d3.thresholdSturges(_.flatten(this._data))))
        const tickNum = d3.thresholdSturges(_.flatten(this._data));
        return this.x.ticks(tickNum);
    }

    private getYScales(): d3.ScaleLinear<number, number> {
        const yMax = this._style.mode === 'side-by-side' ?
            d3.max(this._bins, bs => d3.max(bs, d => d.length)) : 
            d3.max(transMax(this._bins), bs => d3.sum(bs, d => d.length));
        return d3.scaleLinear().range(this.yRange).domain([0, yMax || 1]);;
    }

    public get xRange(): [number, number] {
        return [0, this._style.width]
    }

    public get yRange(): [number, number] {
        return [0, this._style.height];
    }

    public get x(): d3.ScaleLinear<number, number> {
        return this._style.xScale!;
    }

    public get y(): d3.ScaleLinear<number, number> {
        return this._style.yScale!;
    }

    public get ticks() {
        return this._style.ticks;
    }

    public get groupedBarWidth() {
        const nBins = this._bins[0].length;
        return (this.xRange[1] - this.xRange[0]) / nBins;
    }

    public get barWidth() {
        const nGroups = this._bins.length;
        const groupedBarWidth = this.groupedBarWidth - this._style.innerPadding;
        return Math.max(this._style.mode === 'side-by-side' ?
            (groupedBarWidth / nGroups - this._style.groupInnerPadding) : groupedBarWidth, 1)
    }

    public get layout(): BarLayout[][] {
        const nGroups = this._bins.length;
        const nBins = this._bins[0].length;

        const barWidth = this.barWidth;
        const dx: number[][] = _.range(nGroups).map((d, i) => _.range(nBins).map(() =>
            this._style.mode === 'side-by-side' ? i * (barWidth + this._style.groupInnerPadding) : 0));
        const dy: number[][] = _.range(nGroups).map((d, groupId) => _.range(nBins).map((d, binId) =>
            this._style.mode === 'side-by-side' ? 0 :
                this.y(d3.sum(
                    this._bins.map(bins => bins[binId].length).filter((d, i) => i < groupId)
                )) + (groupId > 0 ? this.yRange[0] : 0)
        ));

        return this._bins.map((bins, groupId) => bins.map((bin, binId) => {
            const Layout: BarLayout = {
                ...bin,
                x: this.x(bin.x0 as number) + dx[groupId][binId],
                y: this._style.direction === 'up' ? (this.yRange[1] - dy[groupId][binId] - this.y(bin.length)) : dy[groupId][binId],
                // y: this.yRange[1] - dy[groupId][binId] - this.y(bin.length),
                width: barWidth,
                height: this.y(bin.length) - this.y(0),
            } as BarLayout;
            return Layout;
        }))
    }
}
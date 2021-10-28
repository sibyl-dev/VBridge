import * as d3 from "d3";
import React from "react";
import { SignalMeta } from "type";
import { isDefined } from "utils/common";
import { ColorManager } from "./color";
import { getOffsetById, getChildOrAppend } from "./common";

import "./Links.scss"

export type ILinkOptions = {

};

export type ILinkData = {
    x1: number,
    x2: number,
    y1: number,
    y2: number,
    color?: string
}

export function drawLinks(params: {
    root: SVGElement | SVGGElement,
    data: ILinkData[][],
    options?: Partial<ILinkOptions>
}) {
    const { root, data, options } = params;
    const base = getChildOrAppend(d3.select(root), 'g', 'link-base');
    const linkGroups = base.selectAll(".between-view-link-g")
        .data(data)
        .join(
            enter => enter.append("g")
                .attr("class", "between-view-link-g"),
            update => update,
            exit => exit.remove()
        );
    linkGroups.selectAll(".between-view-link")
        .data(d => d)
        .join(
            enter => enter.append("path")
                .attr("class", "between-view-link"),
            update => update,
            exit => exit.remove()
        )
        .attr('d', d => {
            const delta = (d.x2 - d.x1) / 2;
            const path = d3.path();
            path.moveTo(d.x1, d.y1);
            path.bezierCurveTo(d.x1 + delta, d.y1, d.x2 - delta, d.y2, d.x2, d.y2);
            return path.toString()
        })
        .style('stroke', d => d.color || 'eee');

    base.selectAll(".between-view-dot")
        .data(data)
        .join(
            enter => enter.append("circle")
                .attr("class", "between-view-dot"),
            update => update,
            exit => exit.remove()
        )
        .attr("cx", d => d[0].x2)
        .attr("cy", d => d[0].y2)
        .attr("r", 3)
        .style('fill', d => d[0].color || 'eee');
}

export interface LinkProps extends ILinkOptions {
    signalMetas: SignalMeta[]
    height?: number,
    width?: number,
    colorManager?: ColorManager,
}

export default class Links extends React.PureComponent<LinkProps> {
    private ref: React.RefObject<SVGSVGElement> = React.createRef();
    private paintId: any = undefined;
    constructor(props: LinkProps) {
        super(props);
        this.paint = this.paint.bind(this);
    }

    componentDidMount() {
        this.paintId = setInterval(this.paint);
    }

    componentDidUpdate(prevProps: LinkProps) {
        if (prevProps !== this.props) {
            this.paint();
        }
    }

    componentWillUnmount() {
        window.clearInterval(this.paintId);
        this.unpaint();
    }

    _fetchPostions() {
        const { signalMetas, colorManager } = this.props;
        const headerHeight = document.getElementById('header')?.offsetHeight || 0;
        const positions = signalMetas.map(signal => {
            const end = getOffsetById(`temporal-view-element-${signal.itemId}`);
            if (end && end.top > (headerHeight + 250)
                && end.bottom < window.innerHeight) {
                const starts = signal.relatedFeatureNames.map(featureName =>
                    getOffsetById(`feature-view-element-${featureName}`))
                    .filter(isDefined)
                    .filter(start => (start.top > 300 + headerHeight) &&
                        (start.bottom < window.innerHeight + 20))
                    ;
                return starts.map((start, i) => ({
                    x1: start.right,
                    y1: (start.top + start.bottom) / 2 - headerHeight,
                    x2: end.left,
                    y2: (end.top + end.bottom) / 2 - headerHeight,
                    color: colorManager?.entityColor(signal.entityId)
                }))
            }
        }).filter(isDefined).filter(d => d.length > 0);
        return positions;
    }

    paint() {
        const { ...rest } = this.props;
        const node = this.ref.current;
        const data = this._fetchPostions();
        if (node) {
            drawLinks({
                root: node,
                data: data,
                options: rest
            })
        }
    }

    unpaint() {
        const node = this.ref.current;
        if (node) {
            drawLinks({
                root: node,
                data: [],
            })
        }
    }

    render() {
        const { height, width } = this.props;
        return <div className="link-svg-container">
            <svg ref={this.ref} style={{ width: width, height: height }} />
        </div>
    }
}

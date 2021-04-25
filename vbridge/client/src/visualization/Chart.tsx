import { shallowCompare } from "data/common";
import * as _ from 'lodash';
import * as React from 'react';

export interface ChartProps  {
    width: number,
    height: number,

    className?: string,
    style?: React.CSSProperties,
    svgStyle?: React.CSSProperties,
}

export default class Chart<P extends ChartProps, S={}, SS={}> extends React.PureComponent<P, S, SS> {
    protected svgRef: React.RefObject<SVGSVGElement> = React.createRef();
    protected shouldPaint: boolean = false;

    constructor(props: P) {
        super(props);
        this.paint = this.paint.bind(this);
    }

    protected paint() {}

    public componentDidMount() {
        this.paint();
    }

    public componentDidUpdate(
        prevProps: P,
    ) {
        if (!shallowCompare(this.props, prevProps, undefined, true)) {
            this.shouldPaint = true;
            const delayedPaint = () => {
                if (this.shouldPaint) this.paint();
            };
            window.setTimeout(delayedPaint, 100);
        }
    }

    public render() {
        const { style, svgStyle, className, width, height } = this.props;
        return (
            <div className={className} style={style}>
                <svg
                    ref={this.svgRef}
                    style={svgStyle}
                    width={width}
                    height={height}
                />
            </div>
        );
    }
}
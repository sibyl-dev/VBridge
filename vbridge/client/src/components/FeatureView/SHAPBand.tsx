import * as _ from "lodash"

export const SHAPContributions = (params: {
    contribution: number,
    contributionIfNormal?: number
    x: d3.ScaleLinear<number, number>,
    height: number,
    posRectStyle?: React.CSSProperties,
    negRectStyle?: React.CSSProperties
}) => {
    const {  x, height, posRectStyle, negRectStyle } = params;
    const cont = Math.max(params.contribution, Math.min(params.contribution, x.domain()[1]), x.domain()[0]);
    const whatifcont = params.contributionIfNormal;
    const posSegValue = _.range(0, 3).fill(0);
    const negSegValue = _.range(0, 3).fill(0);
    const width = x.range()[1] - x.range()[0];
    if (cont > 0) posSegValue[0] = cont;
    else negSegValue[0] = -cont;
    if (whatifcont !== undefined) {
        // positive common segments: a & b
        posSegValue[0] = (cont >= 0 && whatifcont >= 0) ? Math.min(cont, whatifcont) : 0;
        // positive differences: a - b
        posSegValue[1] = (cont >= 0) ? Math.max(0, cont - Math.max(0, whatifcont)) : 0;
        // positive differences: b - a
        posSegValue[2] = (whatifcont >= 0) ? Math.max(0, whatifcont - Math.max(0, cont)) : 0;

        // negative common segments: a & b
        negSegValue[0] = (cont < 0 && whatifcont <= 0) ? Math.min((-cont), (-whatifcont)) : 0;
        // negative differences: a - b
        negSegValue[1] = (cont < 0) ? Math.max(0, (-cont) - Math.max(0, (-whatifcont))) : 0;
        // negative differences: b - a
        negSegValue[2] = (whatifcont < 0) ? Math.max(0, (-whatifcont) - Math.max(0, (-cont))) : 0;
    }
    return <svg className={"contribution-svg"} height={height + 4}>
        <rect className="contribution-background" width={width} height={height + 2} x={x.range()[0]} y={0} />
        {negSegValue[0] > 0 && <rect className="neg-feature a-and-b" style={negRectStyle}
            width={x(negSegValue[0]) - x(0)} y={1} height={height} transform={`translate(${x(-negSegValue[0])}, 0)`} />}
        {negSegValue[1] > 0 && <rect className="neg-feature a-sub-b" style={negRectStyle}
            width={x(negSegValue[1]) - x(0)} y={1} height={height} transform={`translate(${x(-negSegValue[1] - negSegValue[0])}, 0)`} />}
        {negSegValue[2] > 0 && <rect className="neg-feature b-sub-a" style={negRectStyle}
            width={x(negSegValue[2]) - x(0)} y={1} height={height} transform={`translate(${x(-negSegValue[2] - negSegValue[0])}, 0)`} />}

        {posSegValue[0] > 0 && <rect className="pos-feature a-and-b" style={posRectStyle}
            width={x(posSegValue[0]) - x(0)} y={1} height={height} transform={`translate(${x(0)}, 0)`} />}
        {posSegValue[1] > 0 && <rect className="pos-feature a-sub-b" style={posRectStyle}
            width={x(posSegValue[1]) - x(0)} y={1} height={height} transform={`translate(${x(posSegValue[0])}, 0)`} />}
        {posSegValue[2] > 0 && <rect className="pos-feature b-sub-a" style={posRectStyle}
            width={x(posSegValue[2]) - x(0)} y={1} height={height} transform={`translate(${x(posSegValue[0])}, 0)`} />}
        <defs>
            <pattern id="pattern-stripe"
                width="4" height="4"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)">
                <rect width="2" height="4" transform="translate(0,0)" fill="white"></rect>
            </pattern>
            <mask id="mask-stripe">
                <rect x="0" y="0" width="100%" height="100%" fill="url(#pattern-stripe)" />
            </mask>
        </defs>
    </svg>
}
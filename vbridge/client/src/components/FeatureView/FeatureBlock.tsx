import React from "react";

import { CaretRightOutlined, ArrowDownOutlined, ArrowUpOutlined, LineChartOutlined, TableOutlined, QuestionOutlined } from "@ant-design/icons";
import { ArrowRightOutlined, ArrowLeftOutlined } from "@material-ui/icons";
import { Tooltip, Button } from "antd";
import { IDataFrame } from "data-forge";
import { Feature } from "type";
import { StatValues } from "type/resource";
import AreaChart from "visualization/AreaChart";
import BarChart from "visualization/BarChart";
import { ColorManager } from "visualization/color";
import { beautifulPrinter } from "visualization/common";
import { SHAPContributions } from "./SHAPBand";

export interface FeatureBlockProps {
    className?: string,
    depth: number,
    feature: Feature,
    target?: string,
    prediction?: number,
    referenceMat: IDataFrame<number, any>[],
    referenceValues?: IDataFrame<string, StatValues>,
    x: d3.ScaleLinear<number, number>,
    cellWidth: (id: number) => number,
    colorManager?: ColorManager
    focusedFeatures: string[],
    display?: 'normal' | 'dense',
    threshold?: [number, number],

    inspectFeatureInSignal?: (feature: Feature) => void,
    inspectFeatureInTable?: (feature: Feature) => void,
    onCollapse?: (feature: Feature) => void;
}
export interface FeatureBlockStates {
    collapsed: boolean,
    showDistibution: boolean,
    showWhatIf: boolean,
}

export class FeatureBlock extends React.Component<FeatureBlockProps, FeatureBlockStates> {
    constructor(props: FeatureBlockProps) {
        super(props);
        this.state = {
            collapsed: true,
            showDistibution: false,
            showWhatIf: false
        }

        this.onClickButton = this.onClickButton.bind(this);
        this.onClickDiv = this.onClickDiv.bind(this);
        this.hasFeature = this.hasFeature.bind(this);
    }

    private hasFeature(feature: Feature, featureNames: string[]): boolean {
        if (feature.id && featureNames.includes(feature.id))
            return true;
        if (feature.children?.where(row => this.hasFeature(row, featureNames)).count())
            return true;
        else
            return false
    }

    protected onClickButton() {
        const { onCollapse, feature } = this.props;
        this.setState({ collapsed: !this.state.collapsed });
        window.setTimeout(() => onCollapse && onCollapse(feature), 500);
    }

    protected onClickDiv() {
        this.setState({ showDistibution: !this.state.showDistibution });
    }

    render() {
        const { feature, x, cellWidth, colorManager, inspectFeatureInSignal, inspectFeatureInTable,
            className, depth, referenceMat: contextFeatureValues, focusedFeatures, referenceValues, display,
            target, prediction, threshold } = this.props;
        const { collapsed, showDistibution, showWhatIf } = this.state
        const { id: name, alias, value, shap, children, entityId, whatIfPred: predictionIfNormal } = feature;
        const referenceValue = referenceValues ? referenceValues.at(feature.id) : undefined;

        let outofRange: 'none' | 'low' | 'high' = 'none';
        let whatIfValue = undefined;
        if (referenceValue && typeof (value) === typeof (0.0)) {
            const { ci95 } = referenceValue;
            if (value as number > ci95[1]) {
                outofRange = 'high'
                whatIfValue = ci95[1]
            }
            else if (value as number < ci95[0]) {
                outofRange = 'low'
                whatIfValue = ci95[0]
            }
        }
        let showState: 'normal' | 'focused' | 'unfocused' | 'none' = 'normal';
        if (focusedFeatures.length > 0) {
            if (this.hasFeature(feature, focusedFeatures)) showState = 'focused';
            else showState = 'unfocused';
        }
        if (display && display === 'dense') {
            if (showState === 'unfocused') showState = 'none';
        }
        if (threshold) {
            // higher is allowed
            if (shap < threshold[0])
                if (showState !== 'focused') showState = 'none';
        }

        const heigth = showDistibution ? 80 : 30;
        const isLeaf = !feature.children || feature.children.count() === 0;

        let id: string | undefined = undefined
        if (isLeaf)
            id = `${className}-${feature.id}`;
        else if (collapsed) {
            const childrenNames = feature.children?.getSeries('name').where(d => d);
            if (childrenNames && childrenNames.count()) {
                id = `${className}-${childrenNames.first()}`;
            }
        }

        return <div>
            <div className="feature-row" style={{
                display: (showState === 'none') ? "none" : "flex", justifyContent: "flex-end", position: "relative",
                width: `calc(100% - ${depth * 10}px)`, left: `${depth * 10}px`
            }}>
                <div style={{ width: 20 }}>
                    {children && <CaretRightOutlined className="right-button"
                        onClick={this.onClickButton} rotate={collapsed ? 0 : 90} />}
                </div>
                <div className={`feature-block ${showState}` + (collapsed ? "" : " expanded")}
                    id={id}
                    style={{
                        height: heigth, borderRightWidth: 4,
                        borderRightColor: colorManager && colorManager.entityColor(entityId)
                    }}
                    onClick={children ? this.onClickButton : this.onClickDiv}>
                    <div className={`feature-block-inner`}>
                        <Tooltip title={alias}>
                            <div className="feature-block-cell feature-name" style={{ width: cellWidth(0) - 10 * depth }}>
                                <span className={"feature-block-cell-text"}>{showDistibution ? alias : beautifulPrinter(alias, 22)}</span>
                            </div>
                        </Tooltip>
                        <div className={"feature-block-cell" + (isLeaf ? " feature-value" : "")}
                            style={{ width: showDistibution ? cellWidth(1) + 40 : cellWidth(1) }}>
                            {showDistibution ?
                                (typeof (value) === 'number') ? <AreaChart
                                    data={contextFeatureValues?.map(mat => mat.getSeries(name).toArray()) as number[][]}
                                    height={70}
                                    width={cellWidth(1) + 40}
                                    drawBottomAxis={true}
                                    margin={{ left: 10, bottom: 20 }}
                                    referenceValue={value as number}
                                    whatIfValue={showWhatIf ? whatIfValue : undefined}
                                    mode="side-by-side"
                                /> : (typeof (value) === 'string') ? <BarChart
                                    data={contextFeatureValues?.map(mat => mat.getSeries(name).toArray()) as string[][]}
                                    height={70}
                                    width={cellWidth(1) + 40}
                                    drawBottomAxis={true}
                                    margin={{ left: 10, bottom: 20 }}
                                    // referenceValue={value}
                                    // whatIfValue={showWhatIf ? whatIfValue : undefined}
                                    mode="side-by-side"
                                /> : <div />
                                : <Tooltip title={typeof (value) == typeof (0.0) ? beautifulPrinter(value) : value}>
                                    <span className={"feature-block-cell-text"}>
                                        {outofRange === 'low' && <ArrowDownOutlined />}
                                        {beautifulPrinter(value)}
                                        {outofRange === 'high' && <ArrowUpOutlined />}
                                    </span>
                                </Tooltip>}
                        </div>
                        <div className={"feature-block-cell feature-contribution"} style={{ width: cellWidth(2) }}>
                            {SHAPContributions({
                                contribution: feature.shap, 
                                contributionIfNormal: showWhatIf ? feature.whatIfShap : undefined, 
                                x, height: 14,
                                posRectStyle: { fill: !collapsed ? '#f8a3bf' : undefined },
                                negRectStyle: { fill: !collapsed ? '#9abce4' : undefined }
                            })}
                            {(shap > x.domain()[1]) && <ArrowRightOutlined className="overflow-notation-right" />}
                            {(shap < x.domain()[0]) && <ArrowLeftOutlined className="overflow-notation-left" />}
                            {showWhatIf && whatIfValue && <div className={"what-if-label"}>
                                {prediction && <div className={"label-circle"} style={{ backgroundColor: 
                                    target && colorManager?.labelColor(target, prediction) }}>
                                    {prediction > 0.5 ? 'High' : 'Low'}
                                </div>}
                                <ArrowRightOutlined />
                                {predictionIfNormal && <div className={"label-circle"} style={{ backgroundColor: 
                                    target && colorManager?.labelColor(target, predictionIfNormal) }}>
                                    {predictionIfNormal > 0.5 ? 'High' : 'Low'}
                                </div>}
                            </div>}
                        </div>
                    </div>
                </div>
                {(isLeaf || collapsed) && <span className={`feature-block-annote ${showState}`} style={{
                    backgroundColor: colorManager?.entityColor(entityId),
                    height: heigth
                }} />}
                <Button size="small" type="primary" shape="circle"
                    icon={<LineChartOutlined />} onClick={() => inspectFeatureInSignal && inspectFeatureInSignal(feature)}
                    className={"feature-button-linechart"}
                />
                <Button size="small" type="primary" shape="circle"
                    icon={<TableOutlined />} onClick={() => inspectFeatureInTable && inspectFeatureInTable(feature)}
                    className={"feature-button-table"}
                />
                {showDistibution && isLeaf && outofRange !== 'none' && <Button size="small" type="primary" shape="circle"
                    icon={<QuestionOutlined />} onClick={() => this.setState({ showWhatIf: !showWhatIf })}
                    className={"feature-button-what-if"}
                />}

            </div>

            {(!collapsed) && children?.toArray().map(feature =>
                <FeatureBlock
                    {...this.props}
                    key={feature.id || `${feature.entityId}-${feature.alias}`}
                    depth={depth + 1}
                    feature={feature}
                />)}
        </div>
    }
}
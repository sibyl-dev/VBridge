import {
    SortAscendingOutlined, ArrowDownOutlined, ArrowUpOutlined,
    FilterOutlined
} from "@ant-design/icons";
import { Button, Popover, Slider } from "antd";
import { IDataFrame } from "data-forge";
import _ from "lodash";
import React from "react";
import { Feature, VFeature, buildShowStateList } from "type";
import { StatValues } from "type/resource";
import { isDefined } from "utils/common";
import { ColorManager } from "visualization/color";
import { getScaleLinear } from "visualization/common";
import { FeatureBlock } from "./FeatureBlock";

const cellWidth = (id: number) => {
    return [150, 100, 150][id];
}

export interface FeatureListProps {
    className?: string,
    features: IDataFrame<number, Feature>,
    shapValues?: number[],
    prediction?: number,
    target?: string,
    referenceMat: IDataFrame<number, any>[],
    referenceValues?: IDataFrame<string, StatValues>,

    focusedFeatures: string[],
    display?: 'normal' | 'dense',
    colorManager?: ColorManager,

    inspectFeatureInSignal?: (feature: Feature) => void,
    inspectFeatureInTable?: (feature: Feature) => void,
}

export interface FeatureListStates {
    // Contribution sorting order
    order?: 'ascending' | 'dscending',
    threshold?: [number, number],
    VFeatureList: IDataFrame<number, VFeature>,
}

export class FeatureList extends React.Component<FeatureListProps, FeatureListStates> {
    constructor(props: FeatureListProps) {
        super(props);

        this.state = { order: 'dscending', VFeatureList: buildShowStateList(props.features) };

        this.onClick = this.onClick.bind(this);
        this.sortFeatures = this.sortFeatures.bind(this);
        this.getDisplayedFeatures = this.getDisplayedFeatures.bind(this);
        this.getContributionXScale = this.getContributionXScale.bind(this);
        this.flipShowState = this.flipShowState.bind(this);
    }

    private onClick(newOrder?: 'ascending' | 'dscending') {
        this.setState({ order: newOrder })
    }

    componentDidUpdate(prevProps: FeatureListProps) {
        if (prevProps.features != this.props.features) {
            this.setState({ VFeatureList: buildShowStateList(this.props.features) });
        }
    }

    private flipShowState(feature: Feature) {
        const VFeatureList = this.state.VFeatureList.select<VFeature>(vFeature => {
            if (vFeature.id === feature.id) {
                vFeature.show = !vFeature.show;
                vFeature.children = vFeature.children?.select(f => ({...f, show: !f.show}));
            }
            return vFeature
        })
        console.log(VFeatureList);
        this.setState({ VFeatureList });
    }

    private sortFeatures(features: IDataFrame<number, any>): IDataFrame<number, any> {
        const { order } = this.state;
        if (order === 'ascending')
            features = features.orderBy(row => row.shap);
        else if (order == 'dscending')
            features = features.orderBy(row => -row.shap);
        return features.select(feature => {
            if (feature.children) {
                return {
                    ...feature,
                    children: this.sortFeatures(feature.children)
                }
            }
            else return feature
        })
    }

    private getDisplayedFeatures(features: IDataFrame<number, VFeature>) {
        let disFeat = features.where(f => f.show).toArray();
        let hidFeat = features.where(f => !f.show);
        for (const feat of hidFeat) {
            const children = feat.children;
            if (children) {
                disFeat = disFeat.concat(this.getDisplayedFeatures(children));
            }
        }
        return disFeat;
    }

    private getContributionXScale() {
        const features = this.getDisplayedFeatures(this.state.VFeatureList);
        const contr = features.map(f => f.shap).map(v => Math.abs(v));
        const whatifContr = features.map(f => f.whatIfShap).filter(isDefined).map(v => Math.abs(v));
        const maxAbsCont = _.max([...contr, ...whatifContr]) as number;
        return getScaleLinear(0, cellWidth(2), undefined, [-maxAbsCont, maxAbsCont]);
    }

    public render() {
        const { features, shapValues, ...rest } = this.props;
        const { order, threshold } = this.state;
        const sortedFeatures = this.sortFeatures(features);
        const shapMin = _.min(shapValues);
        const shapMax = _.max(shapValues);
        const x = this.getContributionXScale();

        return <div style={{ width: "100%" }}>
            <div style={{ width: "100%" }}>
                <div className="feature-header">
                    <div className="feature-header-cell" style={{ width: cellWidth(0) }}>
                        <span>Name</span>
                        <Button type="text" className={'header-buttion'} icon={<SortAscendingOutlined />} />
                    </div>
                    <div className="feature-header-cell" style={{ width: cellWidth(1) }}>
                        <span>Value</span>
                    </div>
                    <div className="feature-header-cell" style={{ width: cellWidth(2) }}>
                        <span>Contribution</span>
                        {order === 'dscending' ?
                            <Button type="text" className={'header-buttion'} size="small" style={{ 'width': '20px' }}
                                icon={<ArrowDownOutlined />}
                                onClick={this.onClick.bind(this, 'ascending')} />
                            : <Button type="text" className={'header-buttion'} size="small" style={{ 'width': '20px' }}
                                icon={<ArrowUpOutlined />}
                                onClick={this.onClick.bind(this, 'dscending')} />}
                        <Popover placement="right" content={
                            <div style={{ width: 160, height: 20 }} onMouseDown={(event) => event.stopPropagation()}>
                                {shapValues && <Slider
                                    tipFormatter={null}
                                    range defaultValue={[_.sortBy(shapValues, d => d)[shapValues.length - 5], shapMax!]}
                                    min={shapMin!} max={shapMax!} step={(shapMax! - shapMin!) / 100}
                                    onAfterChange={(range) => this.setState({ threshold: range })}
                                />}
                            </div>
                        } trigger="click">
                            <Button type="text" className={'header-buttion'} icon={<FilterOutlined />} />
                        </Popover>
                    </div>
                </div>
                <div className="feature-content">
                    {sortedFeatures?.toArray().map(row =>
                        <FeatureBlock
                            {...rest}
                            feature={row}
                            depth={0}
                            x={x}
                            cellWidth={cellWidth}
                            key={row.name || row.alias}
                            threshold={threshold}
                            onCollapse={this.flipShowState}
                        />
                    )}
                </div>
            </div>
        </div>
    }
}
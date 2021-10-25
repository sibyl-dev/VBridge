import {
    SortAscendingOutlined, ArrowDownOutlined, ArrowUpOutlined,
    FilterOutlined
} from "@ant-design/icons";
import { Button, Popover, Slider } from "antd";
import { IDataFrame } from "data-forge";
import _ from "lodash";
import React from "react";
import { Feature, VFeature, buildShowStateList, isGroupFeature } from "type";
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
    referenceMat?: Record<string, any[][]>,
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
    VFeatureList: IDataFrame<number, VFeature>,
    shapExtent?: [number, number]
    threshold?: number,
}

export class FeatureList extends React.Component<FeatureListProps, FeatureListStates> {
    constructor(props: FeatureListProps) {
        super(props);

        this.state = {
            order: 'dscending',
            VFeatureList: buildShowStateList(props.features),
        };

        this.onClick = this.onClick.bind(this);
        this.sortFeatures = this.sortFeatures.bind(this);
        this.getDisplayedFeatures = this.getDisplayedFeatures.bind(this);
        this.getShapXScale = this.getShapXScale.bind(this);
        this.flipShowState = this.flipShowState.bind(this);
    }

    componentDidMount() {
        this.updateShapExtent();
    }

    componentDidUpdate(prevProps: FeatureListProps) {
        if (prevProps.features != this.props.features) {
            this.setState({ VFeatureList: buildShowStateList(this.props.features) });
            this.updateShapExtent();
        }
    }

    private onClick(newOrder?: 'ascending' | 'dscending') {
        this.setState({ order: newOrder })
    }

    private flipShowState(feature: Feature) {
        const VFeatureList = this.state.VFeatureList.select<VFeature>(vFeature => {
            if (vFeature.id === feature.id) {
                vFeature.show = !vFeature.show;
                if (isGroupFeature(vFeature))
                    vFeature.children = vFeature.children.select(f => ({ ...f, show: !f.show }));
            }
            return vFeature
        })
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

    private getFeatureShaps(features: IDataFrame<number, Feature>): number[] {
        let shaps = features.select(f => f.shap).toArray();
        for (const feat of features) {
            if (isGroupFeature(feat)) {
                shaps = shaps.concat(this.getFeatureShaps(feat.children))
            }
        }
        return shaps
    }

    private updateShapExtent() {
        const { features } = this.props;
        const shaps = this.getFeatureShaps(features);
        this.setState({ shapExtent: [_.min(shaps), _.max(shaps)] as [number, number] })
    }

    private getDisplayedFeatures(features: IDataFrame<number, VFeature>) {
        let disFeat = features.where(f => f.show).toArray();
        let hidFeat = features.where(f => !f.show);
        for (const feat of hidFeat) {
            if (isGroupFeature(feat)) {
                disFeat = disFeat.concat(this.getDisplayedFeatures(feat.children));
            }
        }
        return disFeat;
    }

    private getShapXScale() {
        const features = this.getDisplayedFeatures(this.state.VFeatureList);
        const contr = features.map(f => f.shap).map(v => Math.abs(v));
        const whatifContr = features.map(f => f.whatIfShap).filter(isDefined).map(v => Math.abs(v));
        const maxAbsCont = _.max([...contr, ...whatifContr]) as number;
        return getScaleLinear(0, cellWidth(2), undefined, [-maxAbsCont, maxAbsCont]);
    }

    public render() {
        const { features, ...rest } = this.props;
        const { order, threshold, shapExtent } = this.state;
        const sortedFeatures = this.sortFeatures(features);
        const x = this.getShapXScale();
        const absShapMax = _.max(shapExtent?.map(d => Math.abs(d)));

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
                                {absShapMax && <Slider defaultValue={0} range={false}
                                    min={0} max={absShapMax} step={absShapMax / 100}
                                    onAfterChange={(threshold) => this.setState({ threshold })}
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
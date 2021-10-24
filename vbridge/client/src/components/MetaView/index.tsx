import * as React from "react";
import { Row, Col, Divider, Button } from "antd"
import { FeatureSchema, PatientStatics } from "type/resource";
import { PushpinOutlined } from "@ant-design/icons";

import "./index.scss"
import _ from "lodash";
import { ColorManager } from "visualization/color";

export interface MetaViewProps {
    className?: string,
    patientStatics?: PatientStatics,
    featureSchema: FeatureSchema[],
    updateFocusedFeatures?: (featureNames: string[]) => void,
    updatePinnedFocusedFeatures?: (featureNames: string[]) => void,
    colorManager?: ColorManager,
}

export default class MetaView extends React.PureComponent<MetaViewProps> {

    constructor(props: MetaViewProps) {
        super(props);
        this.onHover = this.onHover.bind(this);
        this.onLeave = this.onLeave.bind(this);
        this.onPin = this.onPin.bind(this);
    }

    private onHover(name: string) {
        const { updateFocusedFeatures, featureSchema: featureMeta } = this.props;
        const targetFeature = featureMeta.find(row => row.alias === name);
        if (targetFeature)
            updateFocusedFeatures && updateFocusedFeatures([targetFeature.id]);
    }

    private onLeave() {
        const { updateFocusedFeatures } = this.props;
        updateFocusedFeatures && updateFocusedFeatures([]);
    }

    private onPin(name: string) {
        const { updatePinnedFocusedFeatures, featureSchema: featureMeta } = this.props;
        const targetFeature = featureMeta.find(row => row.alias === name);
        if (targetFeature)
            updatePinnedFocusedFeatures && updatePinnedFocusedFeatures([targetFeature.id]);
    }

    private balanceItems(patientStatics?: PatientStatics): [PatientStatics, PatientStatics] {
        const left: PatientStatics = [];
        const right: PatientStatics = [];
        patientStatics?.forEach(entity => {
            if (_.sum(left.map(e => Object.keys(e.items)))
                <= _.sum(right.map(e => Object.keys(e.items)))) {
                left.push(entity);
            }
            else {
                right.push(entity);
            }
        })
        return [left, right];
    }

    public render() {
        const { patientStatics, featureSchema, className, colorManager } = this.props;
        const featureAlias = featureSchema.map(f => f.alias);
        const [left, right] = this.balanceItems(patientStatics);
        return (
            <div className={"meta-view"}>
                <MetaColumn
                    entities={left}
                    className={className}
                    featureAlias={featureAlias}
                    onHover={this.onHover}
                    onLeave={this.onLeave}
                    onPin={this.onPin}
                    colorManager={colorManager}
                />
                <MetaColumn
                    entities={right}
                    className={className}
                    featureAlias={featureAlias}
                    onHover={this.onHover}
                    onLeave={this.onLeave}
                    onPin={this.onPin}
                    colorManager={colorManager}
                />
            </div>
        )
    }
}

interface MetaColumnProps extends MetaItemParams {
    className?: string,
    entities: PatientStatics,

    onHover: (name: string) => void,
    onLeave: () => void,
    onPin?: (name: string) => void,
}

const MetaColumn = (params: MetaColumnProps) => {
    const { entities, onHover, onPin, ...rest } = params;
    return (<div className={"meta-view-column"}>
        {entities.map(items => <div key={items.entityId}>
            <Divider orientation="center" style={{ margin: 6 }}> {items.entityId} </Divider>
            {Object.keys(items.items).map(name => {
                let value = items.items[name];
                if (name.indexOf("TIME") != -1) {
                    value = value.substr(11, 8);
                }

                return <MetaItem
                    key={name}
                    name={name}
                    value={value}
                    entityId={items.entityId}
                    onHover={() => onHover(name)}
                    onPin={onPin && (() => onPin(name))}
                    {...rest}
                />
            })}
        </div>
        )}
    </div>)
}

export interface MetaItemParams {
    featureAlias: string[],
    colorManager?: ColorManager,
}

export interface MetaItemProps extends MetaItemParams {
    className?: string,
    name: string,
    value: any,
    entityId: string,
    onHover: () => void,
    onLeave: () => void,
    onPin?: () => void,
}

export interface MetaItemStates {
    pinned: boolean,
}

export class MetaItem extends React.PureComponent<MetaItemProps, MetaItemStates> {
    constructor(props: MetaItemProps) {
        super(props);

        this.state = { pinned: false };
        this.pin = this.pin.bind(this);
    }

    private pin() {
        const { onPin } = this.props;
        this.setState({ pinned: !this.state.pinned });
        onPin && onPin();
    }

    public render() {
        const { entityId, name, value, featureAlias, onHover, onLeave, className, colorManager } = this.props;
        const { pinned } = this.state;
        let displayName = name.replace(/_/g, " ");

        return <Row className={'meta-item'} id={`${className}-${name}`}
            style={{
                borderLeftWidth: featureAlias.includes(name) ? 4 : 0,
                borderLeftColor: colorManager?.entityColor(entityId)
            }}
            onMouseOver={onHover} onMouseOut={onLeave}>
            <Col span={1} />
            <Col span={10}>
                <span className="details-title"> {displayName}: </span>
            </Col>
            <Col span={1} />
            <Col span={11}>
                <div className={`value`} >{displayName === 'Diagnosis' ? 'CHD' : value}</div>
            </Col>
            <Col span={1}>
                {(featureAlias.includes(name)) && <Button size="small" type="primary"
                    shape="circle"
                    icon={<PushpinOutlined />} onClick={this.pin}
                    className={"pin"} style={{ display: pinned ? 'block' : undefined }}
                />}
            </Col>
        </Row>
    }
}
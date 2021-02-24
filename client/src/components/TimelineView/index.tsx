import { PatientMeta } from "data/patient";
import { Entity } from "data/table";
import * as React from "react";
import { getPatientRecords } from "router/api";
import { defaultCategoricalColor, getScaleTime } from "visualization/common";
import { drawTimeline } from "visualization/timeline";
import Panel from "../Panel"
import "./index.css"

export interface TimelineViewProps {
    patientMeta?: PatientMeta,
    tableNames: string[]
}

export interface TimelineViewStates {
    tableRecords?: Entity<number, any>[]
}

export default class TimelineView extends React.Component<TimelineViewProps, TimelineViewStates> {

    constructor(props: TimelineViewProps) {
        super(props);
        this.state = {};

        
    }

    componentDidMount() {
        this.loadPatientRecords();
    }

    private async loadPatientRecords() {
        const { patientMeta, tableNames } = this.props;
        if (patientMeta === undefined) return;
        const tableRecords: Entity<number, any>[] = []
        for (let tableName of tableNames) {
            const records = await getPatientRecords({ table_name: tableName, subject_id: patientMeta.subjectId });
            tableRecords.push(records)
        }
        this.setState({ tableRecords });
    }

    public render() {
        const { tableRecords } = this.state;
        const { patientMeta } = this.props;

        return (
            <Panel initialWidth={800} initialHeight={260} x={405} y={0}>
                {tableRecords?.map((entity, i) =>
                (<Timeline
                    startTime = {patientMeta && new Date(patientMeta.startDate)}
                    endTime = {patientMeta && new Date(patientMeta.endDate)}
                    entity={entity}
                    index={i}
                    key={i}
                />))}
            </Panel>
        )
    }
}

export interface TimelineProps {
    className?: string,
    index?: number,
    startTime?: Date,
    endTime?: Date,
    entity: Entity<number, any>,
}

export class Timeline extends React.PureComponent<TimelineProps>{
    private ref: React.RefObject<SVGSVGElement> = React.createRef();
    constructor(props: TimelineProps) {
        super(props);

        this._draw = this._draw.bind(this);
    }

    componentDidMount() {
        this._draw();
    }

    private _draw() {
        const { entity, startTime, endTime } = this.props;
        const groupedEntity = entity.groupBy(row => row[entity.timeIndex!]);
        const events = groupedEntity.toArray().map(group => {
            return {
                timestamp: new Date(group.first()[entity.timeIndex!]),
                count: group.count()
            }
        })
        const index = (this.props.index === undefined) ? 0 : this.props.index;
        const node = this.ref.current;
        if (node) {
            drawTimeline({
                events: events,
                svg: node,
                width: 600,
                height: 40,
                color: defaultCategoricalColor(index),
                startTime: startTime,
                endTime: endTime,
            })
        }
    }

    public render() {
        const { className, entity } = this.props;

        return <div className={"timeline" + (className ? ` ${className}` : "")}>
            <div className={"timeline-title"}>{entity.name}</div>
            <div className={"timeline-content"}>
                <svg ref={this.ref} className={"timeline-svg"} />
            </div>
        </div>
    }
}
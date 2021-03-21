import * as React from "react";
import * as d3 from "d3";
import * as _ from "lodash"
import { PatientMeta } from "data/patient";
import { Entity } from "data/table";
import { defaultCategoricalColor, getScaleTime, IMargin } from "visualization/common";
import { IEvent } from "data/event";
import { TimelineAxis } from "./TimelineAxis";
// import { Timeline } from "./Timeline";

import "./index.css"
import { TimelineList } from "./TimelineList";
import { FeatureMeta } from "data/feature";
import { IDataFrame } from "data-forge";


const ONE_HOUR = 60
const ONE_MIN = 1
const definedIntervalMins = [15*ONE_MIN, 30*ONE_MIN, ONE_HOUR, 2*ONE_HOUR, 4*ONE_HOUR, 6*ONE_HOUR, 12*ONE_HOUR, 24*ONE_HOUR]


export interface TimelineViewProps {
    patientMeta?: PatientMeta,
    featureMeta: IDataFrame<number, FeatureMeta>,
    tableRecords?: Entity<number, any>[],
    onSelectEvents?: (entityName: string, startDate: Date, endDate: Date) => void,
    entityCategoricalColor?: (entityName?: string) => string,
}

export interface TimelineViewStates {
    timeScale?: d3.ScaleTime<number, number>,
    // events?: VEventGroup[][],
    events?: IEvent[][],
    wholeEvents?: IEvent[][],
    choseInterval?: number,
    startDate?: Date,
    endDate?: Date,
    size?: number,
}

export default class TimelineView extends React.Component<TimelineViewProps, TimelineViewStates> {
    private ref: React.RefObject<HTMLDivElement> = React.createRef();
    constructor(props: TimelineViewProps) {
        super(props);
        this.state = {};

        this.updateTimeScale = this.updateTimeScale.bind(this);
        this.color = this.color.bind(this);
        this.calculateNewTime = this.calculateNewTime.bind(this)
        this.calIntervals = this.calIntervals.bind(this)
    }
    // public 

    public componentDidMount() {
        this.init()
    }
    public init(){
        const {patientMeta} = this.props
        let startDate = patientMeta && patientMeta.AdmitTime;
        let endDate = patientMeta && patientMeta.SurgeryEndTime;
        if(startDate && endDate){
            console.log('init', startDate, endDate)
            this.setState({startDate: new Date(startDate), endDate: new Date(endDate)}, ()=>{this.calIntervals();})
        }
    }

    public componentDidUpdate(prevProps: TimelineViewProps, prevStates: TimelineViewStates) {
        if (prevProps.patientMeta !== this.props.patientMeta) {
            this.init()
            // this._extractEvents();
            this.setState({ timeScale: undefined });
        }
        if (prevStates.timeScale !== this.state.timeScale){
            this.calIntervals()
            // this.forceUpdate(); 
        }

    }
    public calculateNewTime(time: Date){
        const interval = this.state.choseInterval
        let startDate = this.state.startDate
        // min
        time = new Date(time)
        if(interval && interval < 60){
            let mins = Math.round(time.valueOf()/1000/60)
            return new Date((mins - mins%interval)*1000*60)!
        }
        // hours
        if(interval && startDate){
            let hrs = Math.floor(time.valueOf()/1000/60/60)
            let startHrs = Math.floor(startDate.valueOf()/1000/60/60)
            let finalHrs = Math.floor(hrs - (hrs-startHrs)%(interval/60))
            return new Date(finalHrs*1000*60*60)!
        }
     
    }
    public updateStartEnd(){
        let {choseInterval, startDate, endDate} = this.state
        if(choseInterval && startDate && endDate && choseInterval<60){
            startDate = this.calculateNewTime(startDate)
            endDate = this.calculateNewTime(endDate)
        }
        else{ 
            let hrs = Math.floor(startDate!.valueOf()/1000/60/60)
            startDate = new Date((hrs - hrs%(choseInterval!/ONE_HOUR))*1000*60*60)!
            hrs = Math.floor(endDate!.valueOf()/1000/60/60)
            endDate = new Date((hrs - hrs%(choseInterval!/ONE_HOUR))*1000*60*60)!
        }
        this.updateTimeScale(d3.scaleTime().range([0, 700]).domain([startDate!, endDate!]), startDate!, endDate!)
        this.setState({startDate, endDate}, ()=>{this._extractEvents();})
    }
    public calIntervals(){
        let startDate = undefined
        let endDate = undefined
        if(this.state.endDate)
            endDate = new Date(this.state.endDate)
        if(this.state.startDate)
            startDate = new Date(this.state.startDate)

        let mins = 0
        if(startDate && endDate){
            mins =  Math.round((endDate.valueOf() - startDate.valueOf())/1000/60)
            let choseInterval = 0
            let size=6
            for(let i=definedIntervalMins.length; i>=0; i--){
                for(size = 7; size<=9; size++){
                    if(definedIntervalMins[i]*size>=mins){
                        choseInterval = definedIntervalMins[i]
                        break
                    }
                    if(choseInterval)
                        break
                }
                
            }
            if(choseInterval==0) choseInterval= Math.round(mins/60/8)*ONE_HOUR

            size = Math.ceil(mins/choseInterval)

            if(choseInterval && startDate && endDate && choseInterval<60){
                startDate = this.calculateNewTime(startDate)
                endDate = this.calculateNewTime(endDate)
            }
            else{ 
                let hrs = Math.floor(startDate!.valueOf()/1000/60/60)
                startDate = new Date((hrs - hrs%(choseInterval!/ONE_HOUR) - 8)*1000*60*60)!
                hrs = Math.floor(endDate!.valueOf()/1000/60/60)
                endDate = new Date((hrs - hrs%(choseInterval!/ONE_HOUR) - 8 + choseInterval!/ONE_HOUR)*1000*60*60)!
            }

            console.log('before setting', startDate, endDate, choseInterval!/60)

            const width = 700;
            const margin: IMargin = { left: 15, right: 15, top: 0, bottom: 7 }
            let {timeScale} = this.state
            if (!timeScale) {
                const extent: [Date, Date] | undefined = startDate && endDate && [startDate, endDate];
                timeScale = extent && getScaleTime(0, width - margin.left - margin.right, undefined, extent);
            }

            this.setState({choseInterval, size, startDate, endDate, timeScale}, ()=> {this._extractEvents();})

            // if(choseInterval)
            console.log('calIntervals', 'events', mins, choseInterval, size)


        }

        
    }

    private _extractEvents() {
        const { tableRecords } = this.props
        const {choseInterval, startDate, endDate} = this.state

        console.log('_extractEvents', startDate, endDate, choseInterval!/60)
        if (tableRecords && choseInterval) {
            // const events = tableRecords.map(entity => calculateTracks(groupEvents(entity, 24)));
            const events: IEvent[][] = [];
            for (const entity of tableRecords) {
                const { timeIndex, name } = entity;

                const modifiedDf = entity.transformSeries({
                     [entity.timeIndex!]: columnValue => this.calculateNewTime(columnValue)
                });

                const groupedEntity = modifiedDf.groupBy(row => row[entity.timeIndex!]);

                const e: IEvent[] = groupedEntity.toArray().map(group => ({
                    entityName: name!,
                    timestamp: new Date(group.first()[timeIndex!]),
                    count: group.count()
                }))

                events.push(e);
            }
            console.log('events',this.state.choseInterval, events)
            if(this.state.wholeEvents==undefined)
                this.setState({wholeEvents:Object.assign([], events)})
            this.setState({ events })
        }
    }

    public updateTimeScale(scale: d3.ScaleTime<number, number>, startDate: Date, endDate: Date) {
        console.log('updateTimeScale', ' events', startDate, endDate)
        this.setState({timeScale:scale})
        this.setState({startDate, endDate})
        this.setState({ timeScale: scale, startDate: startDate, endDate: endDate});

        // this.calIntervals();
        // this._extractEvents()
    }

    private color(id: number) {
        const { entityCategoricalColor, tableRecords } = this.props;
        if (entityCategoricalColor && tableRecords) {
            return entityCategoricalColor(tableRecords[id].name);
        }
        else {
            return defaultCategoricalColor(id);
        }
    }

    public render() {
        const { patientMeta, tableRecords, onSelectEvents } = this.props;
        let { timeScale, events, size, choseInterval, wholeEvents } = this.state;
        const startDate = patientMeta && patientMeta.AdmitTime;
        const endDate = patientMeta && patientMeta.SurgeryEndTime;
        
        const width = 700;
        const margin: IMargin = { left: 15, right: 15, top: 0, bottom: 7 }
        if (!timeScale) {
            const extent: [Date, Date] | undefined = startDate && endDate && [startDate, endDate];
            timeScale = extent && getScaleTime(0, width - margin.left - margin.right, undefined, extent);
        }
        console.log('Timeline index, events', events)

        return (
            <div style={{ height: "100%", width: "100%" }}>
                {tableRecords && choseInterval&& events && <div ref={this.ref} className={"timeline-view-content"}>
                    <TimelineList
                        events={events}
                        titles={tableRecords.map(t => t.metaInfo?.alias || t.metaInfo?.name)}
                        timeScale={timeScale}
                        calculateNewTime={this.calculateNewTime}
                        timelineStyle={{
                            width: width,
                            margin: margin
                        }}
                        onSelectEvents={(id: number, startDate: Date, endDate: Date) =>
                            onSelectEvents && onSelectEvents(tableRecords[id].name!, startDate, endDate)}
                        color={this.color}
                        margin={{top: 0, bottom: 0, left: 0, right: 0}}
                        size={choseInterval}
                    />
                </div>}
                {tableRecords && choseInterval && <TimelineAxis
                    className="fix-on-bottom"
                    startTime={startDate}
                    endTime={endDate}
                    timelineStyle={{
                        width: width,
                        height: 60,
                        margin: { ...margin, bottom: 20, top: 0 }
                    }}
                    updateTimeScale={this.updateTimeScale}
                    events={wholeEvents}
                    color={defaultCategoricalColor}
                    size={choseInterval}
                />}

            </div>
        )
    }
}
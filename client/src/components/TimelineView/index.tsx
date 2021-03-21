import * as React from "react";
import * as d3 from "d3";
import * as _ from "lodash"
import { PatientMeta } from "data/patient";
import { Entity } from "data/table";
import { defaultCategoricalColor, getScaleTime, IMargin, calIntervalsCommon } from "visualization/common";
import { IEvent } from "data/event";
import { TimelineAxis } from "./TimelineAxis";
// import { Timeline } from "./Timeline";

import "./index.css"
import { TimelineList } from "./TimelineList";
import { FeatureMeta } from "data/feature";
import { IDataFrame } from "data-forge";


const ONE_HOUR = 60
const ONE_MIN = 1
const definedIntervalMins = [15*ONE_MIN, 30*ONE_MIN, ONE_HOUR, 2*ONE_HOUR, 4*ONE_HOUR, 6*ONE_HOUR, 12*ONE_HOUR, 24*ONE_HOUR, 48*ONE_HOUR]


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
    firstStartDate?: Date,
    firstEndDate?: Date,
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

    public componentDidMount() {
        this.init()
    }
    public init(){
        const {patientMeta} = this.props
        let startDate = patientMeta && patientMeta.AdmitTime;
        let endDate = patientMeta && patientMeta.SurgeryEndTime;
        if(startDate && endDate){
            console.log('init', startDate, endDate)
            this.setState({startDate: new Date(startDate), endDate: new Date(endDate), timeScale: undefined, wholeEvents:undefined}, ()=>{this.calIntervals();})
        }
    }

    public componentDidUpdate(prevProps: TimelineViewProps, prevStates: TimelineViewStates) {
        if (prevProps.patientMeta !== this.props.patientMeta) {
            this.init()
        }
        if (prevStates.timeScale !== this.state.timeScale){
            this.calIntervals()
        }

    }
    public calculateNewTime(time: Date){
        const interval = this.state.choseInterval
        let startDate = this.state.startDate
        // min
        time = new Date(time)
        if(interval && interval < 60){
            let mins = Math.floor(time.valueOf()/1000/60)
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
    // public updateStartEnd(startDate: Date, endDate: Date){
    //     let {choseInterval} = this.state
    //      if(choseInterval && choseInterval<60){
    //             startDate = this.calculateNewTime(startDate)!
    //             endDate = this.calculateNewTime(endDate)!
    //     }
    //     else{ 
    //         let hrs = Math.floor(startDate!.valueOf()/1000/60/60)
    //         startDate = new Date((hrs - hrs%(choseInterval!/ONE_HOUR) - 8)*1000*60*60)!
    //         hrs = Math.floor(endDate!.valueOf()/1000/60/60)
    //         endDate = new Date((hrs - hrs%(choseInterval!/ONE_HOUR) - 8 + choseInterval!/ONE_HOUR)*1000*60*60)!
    //     }
    //     // this.updateTimeScale(d3.scaleTime().range([0, 700]).domain([startDate!, endDate!]), startDate!, endDate!)
    //     // this.setState({startDate, endDate}, ()=>{this._extractEvents();})
    // }
    public calIntervals(){
        let startDate:Date = new Date(this.state.startDate!)
        let endDate:Date = new Date(this.state.endDate!)

        if(startDate && endDate){
            // mins =  Math.round((endDate.valueOf() - startDate.valueOf())/1000/60)
            let choseInterval = calIntervalsCommon(startDate, endDate)
            
            // change the start and end to a more fit hours
            if(choseInterval && choseInterval<60){
                startDate = this.calculateNewTime(startDate)!
                endDate = this.calculateNewTime(endDate)!
            }
            else{ 
                // need to minus 8 hours since GMT8:00
                let hrs = Math.floor(startDate!.valueOf()/1000/60/60)
                startDate = new Date((hrs - (hrs+8)%(choseInterval!/ONE_HOUR))*1000*60*60)!
                hrs = Math.floor(endDate!.valueOf()/1000/60/60)
                endDate = new Date((hrs - (hrs+8)%(choseInterval!/ONE_HOUR)+ choseInterval!/ONE_HOUR)*1000*60*60)!
            }

            console.log('before setting', startDate, endDate, choseInterval!/60)

            const width = 700;
            const margin: IMargin = { left: 15, right: 15, top: 0, bottom: 7 }
            let {timeScale, firstStartDate, firstEndDate} = this.state
            if (!timeScale) {
                const extent: [Date, Date] | undefined = startDate && endDate && [startDate, endDate];
                timeScale = extent && d3.scaleTime().domain(extent).range([0, width - margin.left - margin.right])
                firstStartDate =new Date(startDate)
                firstEndDate  = new Date(endDate)
            }

            this.setState({choseInterval, startDate, endDate, timeScale, firstStartDate, firstEndDate}, ()=> {this._extractEvents();})

            // if(choseInterval)
            console.log('calIntervals', 'events', choseInterval, choseInterval/60)
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


                const entityWithnewSeries = entity.generateSeries({
                    Year: row => row[entity.timeIndex!].substr(0,4),
                    Month: row => row[entity.timeIndex!].substr(5,2),
                    Day: row => row[entity.timeIndex!].substr(8,2),
                    Hour: row => row[entity.timeIndex!].substr(11,2),
                    Minute: row => row[entity.timeIndex!].substr(14,2),
                })
                let entityWOoriginaltime = entityWithnewSeries
                // .dropSeries(entity.timeIndex!)
                let modifiedDf = undefined
                let groupName:string = ''
                
                if(choseInterval < ONE_HOUR){
                    modifiedDf = entityWOoriginaltime.transformSeries({
                         Minute: columnValue => Math.floor(columnValue/choseInterval)<10?Math.floor(columnValue/choseInterval):'0'+Math.floor(columnValue/choseInterval),
                    });
                    groupName = 'Minute'
                }
                else if(choseInterval < 24*ONE_HOUR){
                    modifiedDf = entityWOoriginaltime.transformSeries({
                         Hour: columnValue => Math.floor(columnValue/(choseInterval/ONE_HOUR))*(choseInterval/ONE_HOUR), 
                         Minute: columnValue => '00'
                    });
                    groupName = 'Hour'
                }
                else{
                    modifiedDf = entityWOoriginaltime.transformSeries({
                         Day: columnValue => Math.floor(columnValue/(choseInterval/ONE_HOUR/24))*(choseInterval/ONE_HOUR/24),
                         Minute: columnValue => '00',
                         Hour: columnValue =>'00',
                    });
                    groupName = 'Day'
                }
                // modifiedDf = entityWOoriginaltime.transformSeries({
                //     [timeIndex!]:
                // })
                const groupedEntity = modifiedDf.groupBy(row => row['Year']&&row['Month']&&row['Day'] &&row['Hour']&&row['Minute']);

                const e: IEvent[] = groupedEntity.toArray().map(group => ({
                    entityName: name!,
                    timestamp: new Date(group.first()['Year'] + '-' + group.first()['Month'] +'-' + group.first()['Day']+' '
                                       +group.first()['Hour'] + ':' + group.first()['Minute'] + ':00'),
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
        this.setState({timeScale:scale, startDate, endDate})
        // this.setState({})
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
        let { timeScale, events, choseInterval, wholeEvents, startDate, endDate, firstStartDate, firstEndDate } = this.state;
        // const startDate = patientMeta && patientMeta.AdmitTime;
        // const endDate = patientMeta && patientMeta.SurgeryEndTime;
        
        const width = 700;
        const margin: IMargin = { left: 15, right: 15, top: 0, bottom: 7 }
        // if (!timeScale) {
        //     const extent: [Date, Date] | undefined = startDate && endDate && [startDate, endDate];
        //     timeScale = extent && getScaleTime(0, width - margin.left - margin.right, undefined, extent);
        // }
        console.log('Timeline index, events', events)

        return (
            <div style={{ height: "100%", width: "100%" }}>
               
               {tableRecords && choseInterval&& startDate && endDate&& events && <div ref={this.ref} className={"timeline-view-content"}>
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
                {tableRecords && choseInterval && firstStartDate && firstEndDate && <TimelineAxis
                    className="fix-on-bottom"
                    startTime={firstStartDate}
                    endTime={firstEndDate}
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
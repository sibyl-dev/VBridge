import * as React from "react";
import Panel from "../Panel"
import { Row, Col, Select, Card, Divider, Slider, Checkbox, Switch, InputNumber, Button, Radio } from "antd"

import "./index.css"
import { filterType } from 'data/filterType';
import { beautifulPrinter, getScaleLinear } from 'visualization/common'
// import {getPatientGroup} from "../../router/api"
import RangeChose from 'visualization/RangeChose'
import MultiSelect from 'visualization/MultiSelect'

import { getFeatureMatrix, getPatientGroupPart, getPatientGroup} from "router/api";
import { IDataFrame } from "data-forge";


const { Option } = Select
export interface FliterViewProps {
    patientIds?: number[],
    filterRange?: { [key: string]: any },
    filterPatients?: (condition: {[key: string]: any}, changeornot:boolean) => void,
    onClose?:()=>void,
    contribution?: number [],
    visible?: boolean,
    patientInfoMeta?: { [key: string]: any },
    subjectIdG?: number[],
    distributionApp?: number [],
}

export interface FilterViewStates {
    expandItem?: boolean[],
    PATIENTS?: string[],
    ADMISSIONS?: string[],
    SURGERY_INFO?: string[],
    filter_name?: string[],
    checkedList?: object[],
    indeterminate?: boolean[],
    checkedAll?: boolean[],
    changeornot?: boolean,
    tmpConditions?: {[key: string]: any},
    filterConditions?: {[key: string]: any},
    defaultValue?: {[key: string]: any},
    categorical_name?: string[],
    numerical_name?: string[],
    cancel?: boolean,
    featureMatrix?: IDataFrame<number, any>,
    distributionFilter?: number[],
    allPatientNumber?: number,
}
export default class FilterView extends React.Component<FliterViewProps, FilterViewStates> {

    constructor(props: FliterViewProps) {
        super(props);
        // const filterRange = props.filterRange
        this.state = {
            expandItem: Array(8).fill(false),
            checkedAll: Array(8).fill(true),
            indeterminate: Array(8).fill(false),
            checkedList: Array(8).fill(['Empty']),
            changeornot: false ,
            cancel: false,
            filter_name: [  'Height', 'Weight', 'Surgical time (minutes)',
                            'GENDER',  
                            'Age',
                            // 'ETHNICITY',
                            // 'ADMISSION_DEPARTMENT', 
                            // 'DIAGNOSIS', 'ICD10_CODE_CN', 
                            'SURGERY_NAME', 
                            // 'ANES_METHOD','SURGERY_POSITION', 
                              ], 
            categorical_name:[
                                // 'ETHNICITY', 'ADMISSION_DEPARTMENT',  'DIAGNOSIS', 'ICD10_CODE_CN',  'ANES_METHOD','SURGERY_POSITION', 
                                'SURGERY_NAME', 'GENDER' ],
            numerical_name: ['Height', 'Weight', 'Surgical time (minutes)'],
        };
        this.onCheckGender = this.onCheckGender.bind(this)
        this.onClickToConfirm = this.onClickToConfirm.bind(this)
        this.onClickToCancel = this.onClickToCancel.bind(this)
        this.updateConditions = this.updateConditions.bind(this)
    }
    public async init() {
        var checkedList = Array(8).fill([])
        console.log('checkedList', this.props.filterRange, this.state.checkedList)
        const {filterRange, patientInfoMeta, visible, filterPatients, distributionApp, subjectIdG} = this.props
        var {categorical_name, numerical_name,  defaultValue, filterConditions} = this.state
        defaultValue = {'':''}
        filterConditions= {'': ''}

        if(patientInfoMeta && categorical_name && numerical_name){
            numerical_name.map((name,idx)=>{
                if(defaultValue)  defaultValue[name] = [ Math.floor(patientInfoMeta[name]*0.9), Math.ceil(patientInfoMeta[name]*1.1) ]
            })
            categorical_name.map((name, idx) =>{
                if(defaultValue) defaultValue[name] = new Array(patientInfoMeta[name])
            })
            defaultValue['SURGERY_NAME'] = patientInfoMeta['SURGERY_NAME'].split('+')
            defaultValue['Age'] = new Array(this.judgeTheAge(patientInfoMeta['Age']))
        
        }
        if(filterPatients)
            filterPatients(defaultValue, true)
        console.log('here defaultValue', defaultValue)
        let tmp1 = Object.assign({}, defaultValue)
        let tmp2 = Object.assign({}, defaultValue)
        console.log('tmp', tmp1===defaultValue, tmp2===tmp1 )

        console.log('this init', distributionApp)
        this.setState({defaultValue: defaultValue, filterConditions: tmp1, tmpConditions: tmp2, cancel: !visible})
        const subjectIdGFilter =  await getPatientGroup({filterConditions: tmp1?tmp1:{'':''}, subject_id: 0, setSubjectIdG: false})
        const distributionFilter:number[] = Object.assign([],subjectIdGFilter['distribution'])
        const allPatientNumber:number =  subjectIdGFilter.subject_idG.length
        this.setState({distributionFilter, allPatientNumber}, ()=>{console.log(this.state.distributionFilter)})

        // this.setState({ distributionFilter: Object.assign([], distributionApp), allPatientNumber: subjectIdG? subjectIdG.length:0})
    }
    public componentDidMount() {
        this.init();
        this.loadFeatureMatrix();
    }
    private async loadFeatureMatrix() {
        const featureMatrix = await getFeatureMatrix();
        this.setState({ featureMatrix });
    }
    componentDidUpdate(prevProps: FliterViewProps){
        // if(this.props.subjectIdG && prevProps.subjectIdG?.sort().toString() !== this.props.subjectIdG.sort().toString()) {
        //     this.loadFeatureMatrix()
        // }
    }
    componentWillReceiveProps(nextProps: FliterViewProps) {
        if (nextProps.visible) 
            this.setState({cancel: false});
    }
    public judgeTheAge(age: number){
        if(age < 1) return '< 1 month'
        else if (age <= 3) return '1-3 months'
        else if (age <= 12) return '3 months-1 year'
        else return '> 1 year'
    }
    public async distributionRes(){
        const { tmpConditions } = this.state
        const subjectIdGFilter =  await getPatientGroup({filterConditions: tmpConditions?tmpConditions:{'':''}, subject_id: 0, setSubjectIdG: false})
        const distributionFilter:number[] = Object.assign([],subjectIdGFilter['distribution'])
        const allPatientNumber:number =  subjectIdGFilter.subject_idG.length
        this.setState({distributionFilter, allPatientNumber}, ()=>{console.log(this.state.distributionFilter)})
    }

    onClickToConfirm(){
        const { filterPatients, onClose,  } = this.props
        const {tmpConditions} = this.state
        if(filterPatients && tmpConditions && onClose){
             filterPatients(tmpConditions, true)
             const filterConditions = Object.assign({}, tmpConditions)
             console.log('onClickToConfirm', filterConditions === tmpConditions)
             this.setState({filterConditions: filterConditions, cancel: false}, ()=>onClose())
        }
    }
    onClickToCancel(){
        const { onClose, filterPatients, filterRange, patientInfoMeta, distributionApp, subjectIdG} = this.props
        var {filterConditions, filter_name, tmpConditions, defaultValue} = this.state
        var tmpConditions1 = Object.assign({}, filterConditions)
        console.log('onClickToCancel', filterConditions, tmpConditions)

        // change defaultValue according to the filterConditions
        if(filter_name){
            filter_name.map((name:string, idx)=>{
                if(filterConditions &&  defaultValue && filterRange && patientInfoMeta){
                    if(filterConditions.hasOwnProperty(name))
                        defaultValue[name] = filterConditions[name]
                    else if(name='SURGERY_NAME')
                        defaultValue[name] = new Array(patientInfoMeta[name].split('+'))
                    else
                        defaultValue[name] = filterRange[name]
                }
            })
        }
        console.log('onClickToCancel', filterConditions, tmpConditions, defaultValue)
        let tmpContri = Object.assign([], distributionApp)

        if(onClose)
            this.setState({tmpConditions: tmpConditions1, defaultValue: defaultValue, cancel: true, distributionFilter:tmpContri, allPatientNumber: subjectIdG?subjectIdG.length:0}, ()=>onClose())
        // distributionFilter:tmpContri, allPatientNumber: subjectIdG?subjectIdG.length:0
    }
    
    updateConditions(key: string, value: any, checkedAll: boolean) {
        const { tmpConditions } = this.state
        const { filterRange } = this.props
        if (tmpConditions) {
            tmpConditions[key] = value
            if (checkedAll && key!='SURGERY_NAME')
                delete tmpConditions[key]
        }
        this.setState({ tmpConditions}, ()=>{this.distributionRes()})
   }


    onCheckGender(value:any){
        var {defaultValue} = this.state
        if(defaultValue)
            defaultValue['GENDER'] = value
        this.setState({defaultValue})
        var coverAll = false
        if (value.length == 2)
            coverAll = true
        this.updateConditions('GENDER', value, coverAll)
    }
    public render() {
        const { filterRange, patientIds, onClose, filterPatients,patientInfoMeta,  } = this.props
        const { expandItem, PATIENTS, ADMISSIONS, SURGERY_INFO, defaultValue, filter_name, checkedList, indeterminate, 
            checkedAll, tmpConditions, filterConditions, cancel, featureMatrix, distributionFilter, allPatientNumber } = this.state;
        console.log('filterConditions', filterConditions, 'tmpConditions', tmpConditions)
        var conditions: { [key: string]: any } = { '': '' }
        if (tmpConditions)
            conditions = tmpConditions
        const leftSpan = 0
        const titleWidth = 10
        const valueWidth = 11
        const rightSpan = 0
        const complicationtypes = ['Lung Comp.','Cardiac Comp.','Arrhythmia Comp.','Infectious Comp.','Other Comp.', 'No Comp.']

        console.log('distributionFilter', distributionFilter)
        if(distributionFilter)
              var x = getScaleLinear(0, 80, distributionFilter);

       
        return (
            <div id='FilterView'>
             { filter_name && patientInfoMeta && defaultValue && filterRange && filter_name.map((name,idx) => {
                if(name == 'GENDER'){
                    return <>
                        <Divider orientation="left"/>
                        <Checkbox.Group style={{ width: '100%' }} value={defaultValue[name]} defaultValue={patientInfoMeta[name]} onChange={this.onCheckGender}>
                            <Row>
                                  <Col span={6} className='filterName'>{name}:</Col>
                                  <Col span={2}/>
                                  <Col span={8}>
                                        <Checkbox value="F"> Female </Checkbox>
                                    </Col>
                                    <Col span={1} />
                                    <Col span={7}>
                                        <Checkbox value="M"> Male </Checkbox>
                                  </Col>
                            </Row>
                        </Checkbox.Group>
                    </>
                }
                // categorical data with drop down checkbox group
                else if(typeof(filterRange[name][0]) == 'string' || name=='Age'){
                    var value: any = ['Empty']
                    if(defaultValue)
                        value = defaultValue[name]
                    if(indeterminate && checkedAll)
                        return (
                            <MultiSelect  filterName={name}
                                           contents={ name=='SURGERY_NAME'? patientInfoMeta[name].split('+'):filterRange[name]}
                                           key={idx}
                                           defaultValue={value}
                                           cancel={cancel?cancel: false}
                                           updateConditions={this.updateConditions}/>
                        )
   
                }
                // numberic data type, using slider
                else{
                    const max = Math.ceil(filterRange[name][1])
                    const min = Math.floor(filterRange[name][0])
                    var series = featureMatrix?.getSeries(name).parseFloats().toArray();
                    // if (series) {
                    //     // console.log(series.where(row => row > (value as number)).count() / series.count());
                    //     var thresholds = confidenceThresholds(series);
                    //     var colorIndex = _.sum(thresholds.map(t => t < value!));
                    // }
                    return(<>
                                {name!='Height'? <Divider orientation="left"/>:''}
                                <RangeChose filterName={name} 
                                            key={idx} 
                                            min={min}
                                            max={max}
                                            cancel={cancel? cancel: false}
                                            data={series}
                                            referenceValue={patientInfoMeta[name]}
                                            defaultValue={defaultValue?defaultValue[name]:[0,0]}
                                            updateConditions={this.updateConditions}
                                />
                            </>) 
                }
            })}

           {distributionFilter && distributionFilter.map((number, i) => 
               <>
                <Divider orientation="left"/>
                <Row>
                     <Col span={10}> {complicationtypes[i]} </Col>
                     <Col span={10}> 
                         <div className="number" style={{ width: '100%', opacity: Math.max(1 , 0.5) }}>
                           <div className="neg-feature" style={{width: x(number)}} />  
                       </div>
                     </Col>
                     <Col span={4}> {number} </Col>
                 </Row>
                 </>
              )}

           <Divider orientation="left"/>
            <Row>
                 <Col span={10}> Number of Patients: </Col>
                 <Col span={10}> {allPatientNumber} </Col>
             </Row>
           <Divider orientation="left"/>
           <Row>
               <Col span={10} />
               <Col span={4}>
                   <Button value="default" onClick={this.onClickToCancel}>Cancel</Button>
                </Col>
                <Col span={4}/>
                <Col span={4}>
                   <Button value="default" onClick={this.onClickToConfirm}>Confirm</Button>
                </Col>
           </Row> 

             </div>
        )
    }
}

import * as React from "react";
import Panel from "../Panel"
import { Row, Col, Select, Card, Divider, Slider, Checkbox, Switch, InputNumber, Button, Radio} from "antd"
import "./index.css" 
import {filterType} from 'data/filterType';
import {beautifulPrinter} from 'visualization/common'

import ReactEcharts  from 'echarts-for-react';
// import * as echarts from 'echarts';
// import echarts from 'echarts/lib/echarts'
// //导入柱形图
// import 'echarts/lib/chart/bar'
// import 'echarts/lib/component/tooltip'
// import 'echarts/lib/component/title'
// import 'echarts/lib/component/legend'
// import 'echarts/lib/component/markPoint'

import {getPatientGroup} from "../../router/api"

const { Option } = Select

    
// var tmpConditions: {[key: string]: any} = {}
export interface FliterViewProps {
    patientIds?: number[],
    filterRange?: { [key: string]: any },
    filterPatients?: (condition: {[key: string]: any}, changeornot:boolean) => void,
    onClose?:()=>void,
    contribution?: number [],
}

export interface FilterViewStates { 
    expandItem?: boolean[],
    PATIENTS?: string[],
    ADMISSIONS?: string[],
    SURGERY_INFO?: string[],
    filter_name?: string[],
    inputValues?: number[],
    checkedList?: object[],
    indeterminate?: boolean[],
    checkedAll?: boolean[],
    changeornot?: boolean,
    tmpConditions?: {[key: string]: any},
    genderV?: string [],
    filterConditions?: {[key: string]: any}

}
function onChange(value:number []) {
  console.log('onChange: ', value);
}
function onAfterChange(value:number []) {
  console.log('onAfterChange: ', value);
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
            genderV: ['F', 'M'],
            filterConditions: {'': ''},
            tmpConditions: {'' : ''},
            filter_name: ['Age',  'Height', 'Weight', 'Surgical time (minutes)','GENDER', 
                            // 'LANGUAGE', 'RELIGION', 'MARITAL_STATUS', 
                            'ETHNICITY',
                            'ADMISSION_DEPARTMENT', 
                            // 'INSURANCE', 
                            'DIAGNOSIS', 'ICD10_CODE_CN', 
                            'SURGERY_NAME', 'ANES_METHOD','SURGERY_POSITION', 
                                // 'Preoperative oxygen saturation (%)',
                              // 'Oxygen saturation (%)',
                              
                              // 'CPB time (minutes)',
                              // 'Aortic cross-clamping time (times)',
                              // 'complication',
                              // 'lung complication',
                              // 'cardiac complication',
                              // 'arrhythmia complication',
                              // 'infectious complication',
                              // 'other complication',
                              ], 

        };

        this.onCheckAllChange = this.onCheckAllChange.bind(this)
        this.handleMultiSelect = this.handleMultiSelect.bind(this)

        this.onChangeInputValue = this.onChangeInputValue.bind(this)
        this.onInputValueAfterChange = this.onInputValueAfterChange.bind(this)

        this.onCheckGender = this.onCheckGender.bind(this)
        this.onClickToConfirm = this.onClickToConfirm.bind(this)
        this.onClickToCancel = this.onClickToCancel.bind(this)
        this.updateConditions = this.updateConditions.bind(this)
    }
    public init() {
        var inputValues: number[] = []
        var tmparray: string [] = []
        var checkedList = Array(8).fill([])
        console.log('checkedList', this.props.filterRange, this.state.checkedList)

        if(this.props.filterRange){
            const filterRange = this.props.filterRange
            inputValues=[filterRange['Age'][0], filterRange['Age'][1], filterRange['Height'][0], filterRange['Height'][1],
                        filterRange['Weight'][0], filterRange['Weight'][1], filterRange['Surgical time (minutes)'][0], filterRange['Surgical time (minutes)'][1]]
            
            var dropDownName = ['ETHNICITY','ADMISSION_DEPARTMENT', 'INSURANCE', 'DIAGNOSIS', 'ICD10_CODE_CN', 
                            'SURGERY_NAME', 'ANES_METHOD','SURGERY_POSITION',]
            dropDownName.map((name,i)=> {
                checkedList[i] = filterRange[name]
            })
            console.log('checkedList', this.props.filterRange, checkedList)
        }
        
        this.setState({ inputValues, checkedList});
        console.log('checkedList', this.props.filterRange, this.state.checkedList)

    }
    public componentDidMount() {
        this.init();
    }
    // public componentDidUpdate(prevProps: FliterViewProps, prevState: FilterViewStates) {
    //     if (this.props.filterConditions && this.props.filterConditions !== this.state.tmpConditions) {
    //         this.setState({
    //               ...this.state,
    //               tmpConditions: this.props.filterConditions,
    //         })
    //     }
    
    public update(){

    }


    onClickToConfirm(){
        console.log('onClickToConfirm')
        const { filterPatients, onClose,  } = this.props
        const {tmpConditions} = this.state
        if(filterPatients && tmpConditions && onClose){
             filterPatients(tmpConditions, true)
             var filterConditions = tmpConditions
             this.setState({filterConditions}, ()=>onClose())
        }
    }
    onClickToCancel(){
        const { onClose, filterPatients, filterRange} = this.props
        const {filterConditions, filter_name, tmpConditions} = this.state
        var {checkedList, inputValues, checkedAll, indeterminate, genderV} = this.state

        if(filterPatients && filterConditions && onClose && filter_name && tmpConditions && filterRange){
             filterPatients({'':''},false)

             filter_name.map((names:string,idx)=>{
                 if(tmpConditions.hasOwnProperty(names)){
                     // happen this time
                     if(!filterConditions.hasOwnProperty(names)){
                         if(names=='GENDER'){
                             genderV = filterRange[names]
                         }
                         else if(typeof(filterRange[names][0]) == 'string' && checkedList && checkedAll){
                            checkedList[idx-5] = filterRange[names]
                            checkedAll[idx-5] = true
                         }
                         else if(typeof(filterRange[names][0]) == 'number' && inputValues ){
                             inputValues[idx*2] = filterRange[names][0]
                             inputValues[idx*2+1] = filterRange[names][1]
                         }
                     }
                }
                // happen this time or last time
                if(filterConditions.hasOwnProperty(names)){
                    if(names=='GENDER'){
                        genderV=filterConditions[names]
                     }
                     else if(typeof(filterRange[names][0]) == 'string' && checkedList && indeterminate && checkedAll){
                        checkedList[idx-5] = filterConditions[names]
                        if(checkedList[idx-5].toString().length == 0){
                            checkedAll[idx-5] = false
                            indeterminate[idx-5] = false
                        }
                        else
                            indeterminate[idx-5] = true
                     }
                     else if(typeof(filterRange[names][0]) == 'number' && inputValues){
                         inputValues[idx*2] = filterConditions[names][0]
                         inputValues[idx*2+1] = filterConditions[names][1]
                     }
                }
             })
             var tmpConditions1 = filterConditions
             this.setState({tmpConditions: tmpConditions1, genderV: genderV, checkedList: checkedList, inputValues:inputValues, indeterminate: indeterminate, checkedAll: checkedAll}, ()=>onClose())
        }
    }
    updateConditions(key:string, value: any, checkedAll: boolean) {
        const {tmpConditions} = this.state
        const {filterRange} = this.props
        if(tmpConditions){
            tmpConditions[key] = value
            if(checkedAll)
                delete tmpConditions[key]
        }
        this.setState({ tmpConditions })  
   }


    onCheckGender(value:any){
        var genderV = value
        this.setState({genderV})
        var coverAll = false
        if(value.length == 2)
            coverAll = true
        this.updateConditions('GENDER', value, coverAll)
    }

    onCheckAllChange(idx:any, event:any){
        console.log('onCheckAllChange', idx, event, event.target.checked)
        var checkedList  = this.state.checkedList;
        var checkedAll = this.state.checkedAll
        var indeterminate = this.state.indeterminate
        
        if(checkedList && this.state.filter_name && this.props.filterRange)
            if(event.target.checked)
                checkedList[idx] =  this.props.filterRange[this.state.filter_name[idx+5]]
            else 
                checkedList[idx] = []
            
        
        if(checkedAll)
            checkedAll[idx] = event.target.checked
        if(indeterminate)
            indeterminate[idx] = false
        this.setState({checkedList, checkedAll, indeterminate})
        console.log('onCheckAllChange', checkedList && checkedList[idx])


        if(checkedList && this.state.filter_name)
            this.updateConditions(this.state.filter_name[idx+5], checkedList[idx], event.target.checked)
   }

   handleMultiSelect(idx: number, listV:string []){
        console.log('onCheckAllChange', idx, listV)
        var checkedList  = this.state.checkedList;
        var checkedAll = this.state.checkedAll
        var indeterminate = this.state.indeterminate
        if(checkedList)
            checkedList[idx] = listV
        if(this.state.filter_name && this.props.filterRange && checkedAll && indeterminate){ 
            if(listV.length < this.props.filterRange[this.state.filter_name[idx+5]].length && listV.length){
                indeterminate[idx] = true
                checkedAll[idx] = false
            }
            else if(listV.length == this.props.filterRange[this.state.filter_name[idx+5]].length){
                indeterminate[idx] = false
                checkedAll[idx] = true
            }
            else if(listV.length == 0){
                indeterminate[idx] = false
                checkedAll[idx] = false
            }
        }
        this.setState({checkedList, checkedAll, indeterminate})

        if(checkedList && this.state.filter_name && checkedAll)
            this.updateConditions(this.state.filter_name[idx+5], checkedList[idx], checkedAll[idx])
    }

    onChangeInputValue(idx:number, value: any){
        const inputValues:any  = this.state.inputValues;
        const filterRange = this.props.filterRange
        console.log('onChangeInputValue', value, idx, typeof(value)=='number')
        if(typeof(value) == 'number'){
            inputValues[idx] = value
            const trueIdx = idx%2?(idx-1)/2:idx/2            
            if(inputValues && this.state.filter_name && filterRange){
                const name = this.state.filter_name[trueIdx]
                var coverAll = false
                if(inputValues[trueIdx*2] <= filterRange[name][0] && inputValues[trueIdx*2+1] >= filterRange[name][1])
                    coverAll = true
                this.updateConditions(name, [inputValues[trueIdx*2], inputValues[trueIdx*2+1]], coverAll)
            }
        }
        else{
            inputValues[idx*2] = value[0]
            inputValues[idx*2+1] = value[1]
        }
        this.setState({inputValues})

    }
    onInputValueAfterChange(trueIdx: number, value: any){
        console.log('onInputValueAfterChange', trueIdx, value)
        const inputValues:any  = this.state.inputValues;
        const filterRange = this.props.filterRange

        if(inputValues && this.state.filter_name && filterRange){
            const name = this.state.filter_name[trueIdx]
            var coverAll = false
            if(inputValues[trueIdx*2] <= filterRange[name][0] && inputValues[trueIdx*2+1] >= filterRange[name][1])
                coverAll = true
            this.updateConditions(name, [inputValues[trueIdx*2], inputValues[trueIdx*2+1]], coverAll)
            console.log('coverAll', coverAll, name, filterRange[name])
       }
    }


    public render() {
        const { filterRange, patientIds, onClose, filterPatients, contribution } = this.props
        const { genderV, expandItem, PATIENTS, ADMISSIONS, SURGERY_INFO, filter_name, inputValues, checkedList, indeterminate, checkedAll, tmpConditions, filterConditions } = this.state;
        
        console.log('filterConditions', filterConditions, 'tmpConditions', tmpConditions)
        var conditions:{[key:string]: any} = {'':''}
        if(tmpConditions)
            conditions = tmpConditions
        const leftSpan = 0
        const titleWidth = 10
        const valueWidth = 11
        const rightSpan=0

        var data: number [] = []
        if(contribution)
            data = contribution
       
         // const option={
         //        title: { text: 'Patient Number' },
         //        tooltip:{trigger: 'axis'},
         //        xAxis: {data: ['No complication','lung complication','cardiac complication','arrhythmia complication','infectious complication','other complication']},
         //        yAxis: {type: 'value'},
         //        series : [{ name:'Patient Numer', type:'bar',barWidth: '50%',data: contribution, itemStyle: { color: 'blue'} }]
         //        }

        
        
        return (
            <div id='FilterView'>
             { filter_name && filterRange && filter_name.map((name,idx) => {
                if(name == 'GENDER'){
                    return <>
                        <Divider orientation="center"></Divider>
                        <Checkbox.Group style={{ width: '100%' }} value={genderV} defaultValue={filterRange[name]} onChange={this.onCheckGender}>
                            <Row>
                                  <Col span={6} className='filterName'>{name}:</Col>
                                  <Col span={2}/>
                                  <Col span={8}>
                                        <Checkbox value="F"> Female </Checkbox>
                                  </Col>
                                  <Col span={1}/>
                                  <Col span={7}>
                                        <Checkbox value="M"> Male </Checkbox>
                                  </Col>
                            </Row>
                        </Checkbox.Group>

                    </>
                }
                else if(typeof(filterRange[name][0]) == 'string'){
                    const contents:string [] =  filterRange[name]
                    const name1 = name.replace(/_/g," ")
                    var value: any = ['Empty']
                    if(checkedList){
                        value = checkedList[idx-5]
                        // for(let i in value)
                            // value[i] = beautifulPrinter(value[i], 30)                        
                    }
                    // for(let i in contents)
                        // contents[i] = beautifulPrinter(contents[i], 30)
                    return <>
                        <Divider orientation="center"></Divider>
                        <Row>
                           <Col span={6} className='filterName' > {name1}: </Col>
                           <Col span={2}/>
                           <Col span={14}>  
                                   <Select
                                      mode="multiple"
                                      allowClear
                                      style={{ width: '100%' }}
                                      placeholder="Please select"
                                      maxTagCount='responsive'
                                      dropdownMatchSelectWidth={true}
                                      value={value}
                                      onChange={this.handleMultiSelect.bind(this, idx-5)}
                                    >
                                       {contents.map((content,i) =>{
                                          return <>
                                                <Select.Option key={i} value={content}>
                                                    {content} 
                                                 </Select.Option>
                                             </>
                                        })}
                                    </Select> 

                           </Col>
                           <Col span={2}>
                               <Checkbox indeterminate={indeterminate&&indeterminate[idx-5]} style={{ marginLeft: '10px' }} checked={checkedAll&&checkedAll[idx-5]} onChange={this.onCheckAllChange.bind(this,idx-5)}/>
                           </Col>
                        </Row>
                        <Row>
                        </Row>
                    </>
   
                }
                else{
                    const max = filterRange[name][1]
                    const min = filterRange[name][0]
                    return <>
                          {name!='Age'? <Divider orientation="center"> </Divider> :''}
                          <Row>
                              <Col span={6} className='filterName'> {name} : </Col>
                              <Col span={4}>
                                  <InputNumber
                                    min={min}
                                    max={max}
                                    style={{ width: '50px' }}
                                    defaultValue={min}
                                    value={inputValues?inputValues[idx*2]:min}
                                    onChange={this.onChangeInputValue.bind(this, idx*2)}
                                  />
                              </Col>
                              <Col span={10}>
                                  <Slider
                                    range
                                    key={name}
                                    className={name}
                                    min={min}
                                    max={max}
                                    value={inputValues? [inputValues[idx*2],inputValues[idx*2+1]]:[0,100]}
                                    defaultValue={[min, max]}
                                    onChange={this.onChangeInputValue.bind(this, idx)}
                                    onAfterChange={this.onInputValueAfterChange.bind(this, idx)}
                                />
                              </Col>
                              <Col span={3} className='rightValue'>
                                    <InputNumber
                                    min={min}
                                    max={max}
                                    style={{width: '50px' }}
                                    defaultValue={max}
                                    value={inputValues?inputValues[idx*2+1]:max}
                                    onChange={this.onChangeInputValue.bind(this, idx*2+1)}
                                  />
                              </Col>
                           </Row>                        
                    </>
                }  

             })
             } 
             <Row/>
         {/*
                 <ReactEcharts option={option}/> */}
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

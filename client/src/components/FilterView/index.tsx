import * as React from "react";
import Panel from "../Panel"
import { Row, Col, Select, Card, Divider, Slider, Checkbox, Switch, InputNumber} from "antd"
import "./index.css" 
import {filterType} from 'data/filterType';



export interface FliterViewProps {
    patientIds?: number[],
    filterRange?: { [key: string]: any },
    filterPatients?: (condition: {[key: string]: any }) => void,
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
            filter_name: ['Age',  'Height', 'Weight', 'Surgical time (minutes)','GENDER', 
                            // 'LANGUAGE', 'RELIGION', 'MARITAL_STATUS', 
                            'ETHNICITY',
                            'ADMISSION_DEPARTMENT', 'INSURANCE', 'DIAGNOSIS', 'ICD10_CODE_CN', 
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


        this.handleClick = this.handleClick.bind(this);
        this.onCheckAllChange = this.onCheckAllChange.bind(this)
        this.onChangeInputValue = this.onChangeInputValue.bind(this)
        this.handleCheckBox = this.handleCheckBox.bind(this)

        
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

    public conveyConditions(name: string, range:any){
        const { filterPatients } = this.props
        const condition:{[key: string]: any} = {}
        condition[name] = range
        if(filterPatients)
             filterPatients(condition)
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

        if(checkedList && this.state.filter_name)
            this.conveyConditions(this.state.filter_name[idx+5], checkedList[idx])
   }

   handleCheckBox(idx:any, listV:any){
        console.log('onCheckAllChange', idx, listV)
        var checkedList  = this.state.checkedList;
        var checkedAll = this.state.checkedAll
        var indeterminate = this.state.indeterminate
        if(checkedList && this.state.filter_name && this.props.filterRange)
            checkedList[idx] = listV
        if(this.state.filter_name && this.props.filterRange) 
            if(indeterminate && listV.length < this.props.filterRange[this.state.filter_name[idx+5]].length && listV.length)
                indeterminate[idx] = true
            else if(checkedAll && listV.length == this.props.filterRange[this.state.filter_name[idx+5]].length )
                checkedAll[idx] = true
        this.setState({checkedList, checkedAll, indeterminate})

        if(checkedList && this.state.filter_name)
            this.conveyConditions(this.state.filter_name[idx+5], checkedList[idx])
    }


    handleClick(i:number){
        var expandItem:any  = this.state.expandItem;
        expandItem[i] = !expandItem[i]
        this.setState({
          expandItem: expandItem,
        });
    }

    
    onChangeInputValue(idx:number, value: any){

        const inputValues:any  = this.state.inputValues;
        console.log('onChangeInputValue', value, idx, typeof(value)=='number')
        // console.log('before', inputValues)
        if(typeof(value) == 'number'){
            inputValues[idx] = value
            const trueIdx = idx%2?(idx-1)/2:idx/2            
            if(inputValues && this.state.filter_name)
                this.conveyConditions(this.state.filter_name[trueIdx], [inputValues[trueIdx*2], inputValues[trueIdx*2+1]])
        }
        else{
            inputValues[idx*2] = value[0]
            inputValues[idx*2+1] = value[1]
        }
        this.setState({inputValues})
        // console.log('after', this.state.inputValues)


    }

    public render() {
        const { filterRange, patientIds,  } = this.props
        const { expandItem, PATIENTS, ADMISSIONS, SURGERY_INFO, filter_name, inputValues, checkedList, indeterminate, checkedAll } = this.state;
        
        const leftSpan = 0
        const titleWidth = 10
        const valueWidth = 11
        const rightSpan=0
        
        return (
            <div id='FilterView'>
                
             { filter_name && filterRange && filter_name.map((name,idx) => {

                if(name == 'GENDER'){
                    return <>
                        <Divider orientation="center"></Divider>
                        <Checkbox.Group style={{ width: '100%' }} defaultValue={filterRange[name]} onChange={this.conveyConditions.bind(this,name)}>
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
                    // contents.filter((x) => x != '')
                    name = name.replace(/_/g," ")
                    var value: any = ['Empty']
                    if(checkedList){
                        value = checkedList[idx-5]
                        // console.log('here', value, checkedList)
                    }
                    return <>
                        <Divider orientation="center"></Divider>
                        <Row>
                           <Col span={6} className='filterName' > {name}: </Col>
                           <Col span={2}/>
                           <Col span={14}>
                               <div className='firstRow'  onClick={this.handleClick.bind(this,idx-5)}>
                                       {expandItem && expandItem[idx-5]? <img src='tri_fold.png' className='dropDownImg' width='15px'/> : <img src='tri_unfold.png' className='dropDownImg' width='15px'/>} 
                               </div>
                               <Checkbox indeterminate={indeterminate&&indeterminate[idx-5]}  checked={checkedAll&&checkedAll[idx-5]} style={{fontWeight:'bold'}} onChange={this.onCheckAllChange.bind(this,idx-5)}>
                                    Check All
                                </Checkbox>
                               {expandItem&& expandItem[idx-5]?
                                   <>
                                       
                                       <div className='dropDownList'> 
                                               <Checkbox.Group options={filterRange[name]} value={value} onChange={this.handleCheckBox.bind(this, idx-5)}>
                                                    <Row>
                                                        {contents.map(content =>{
                                                            return <>
                                                                    <Col span={20}>
                                                                        <Checkbox key={content} value={content}>{content}</Checkbox>
                                                                    </Col>
                                                                </>
                                                        })}
                                                    </Row>
                                                </Checkbox.Group>     
                                       </div>
                                   </>
                                :''}

                           </Col>
                        </Row>
                        <Row>
                        </Row>
                    </>
   
                }
                else if(name.indexOf("complication") != -1) {
                    return <>
                          <Divider orientation="center"></Divider>
                          <Row>
                              <Col span={12} className='complicationName filterName'>{name}:</Col>

                              <Col span={4}/>
                              <Col span={8}>
                                    <Switch key={name} checkedChildren="Yes" unCheckedChildren="No" defaultChecked onChange={this.conveyConditions.bind(this, name)} />
                               </Col>
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
                                    onAfterChange={this.conveyConditions.bind(this, name)}
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
             </div>
        )
    }
}

                            // tooltipVisible

                            // getTooltipPopupContainer={document.querySelector==null ? () => document.body : () => document.querySelector(".ant-slider-step")}
                    


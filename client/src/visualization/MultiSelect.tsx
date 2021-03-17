
import * as React from "react";
import { Row, Col, Divider, Select, Checkbox} from "antd"

export interface MultiSelctProps {
    filterName: string,
    contents: string[],
    key: number,
    defaultValue: string[],
    cancel: boolean,
    updateConditions:(key:string, value: any, checkedAll: boolean) => void,

    // handleMultiSelect: (idx: number, listV:string []) => void,
    // onCheckAllChange: (idx:number, event:any) => void,
}
export interface MultiSelctStates {
    indeterminate: boolean,
    checkedAll: boolean,
    value: string [],

}

export default class MultiSelect extends React.Component<MultiSelctProps, MultiSelctStates> {
    constructor(props: MultiSelctProps) {
        super(props);
        console.log('RangeChose', props)
        this.state = {value:[], indeterminate:false, checkedAll: false}

        this.handleMultiSelect = this.handleMultiSelect.bind(this)
        this.onCheckAllChange = this.onCheckAllChange.bind(this)
    }
    public init(){
        const value = this.props.defaultValue
        var {checkedAll, indeterminate} = this.state
        if(this.props.filterName == 'SURGERY_NAME'){
        	console.log('SURGERY_NAME', value.length, this.props.contents.length, value, this.props.contents)
        }
       	if(value.length == this.props.contents.length)
       		checkedAll = true
       	else if(value.length != 0)
       		indeterminate = true
    	this.setState({value, checkedAll, indeterminate})
    	// ()=>{console.log('MultiSelect init',this.state.value)}
    }
    public componentDidMount() {
    	this.init()
    }
	componentWillReceiveProps(nextProps: MultiSelctProps) {
		  // You don't have to do this check first, but it can help prevent an unneeded render
		  if (nextProps.defaultValue !== this.state.value && nextProps.cancel == true) {
		    this.setState({value: nextProps.defaultValue});
		  }
	}
    handleMultiSelect(listV:string []){
        console.log('onCheckAllChange', listV)
        var {contents, defaultValue, updateConditions, filterName} = this.props
        var {value, checkedAll, indeterminate} = this.state

        value = listV

        if(listV.length < contents.length && listV.length){
            indeterminate = true
            checkedAll = false
        }
        else if(listV.length == contents.length){
            indeterminate = false
            checkedAll = true
        }
        else if(listV.length == 0){
            indeterminate = false
            checkedAll = false
        }
        this.setState({value, checkedAll, indeterminate})
        updateConditions(filterName, value, checkedAll)
    }
    onCheckAllChange(event:any){
        var {value, checkedAll, indeterminate} = this.state
        var {contents, updateConditions, filterName} = this.props
        if(event.target.checked)
            value =  contents
        else 
            value = []
        checkedAll = event.target.checked
        indeterminate = false
        
        this.setState({value, checkedAll, indeterminate})
        updateConditions(filterName, value, checkedAll)
   }
    public render() {
        var {filterName, contents, defaultValue, key} = this.props
        var {value, indeterminate, checkedAll} = this.state
        
        const name1 = filterName.replace(/_/g," ")
        console.log('MultiSelect', this.props)

        if(defaultValue && value)
	        return(
	        	<>
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
	                              key={filterName}
	                              defaultValue={defaultValue}
	                              onChange={this.handleMultiSelect.bind(this)}
	                            >
	                               {contents.map((content,i) =>
	                                        <Select.Option key={i} value={content}>
	                                            {content} 
	                                         </Select.Option>
	                                    
	                                )}
	                            </Select> 

	                   </Col>
	                   <Col span={2}>
	                       <Checkbox indeterminate={indeterminate} style={{ marginLeft: '10px' }} checked={checkedAll} onChange={this.onCheckAllChange.bind(this)}/>
	                   </Col>
	                </Row> 
	           </>
	    	)
    }

}


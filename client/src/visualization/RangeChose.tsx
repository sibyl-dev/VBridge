
import * as React from "react";
import { Row, Col, Divider, Slider,InputNumber} from "antd"



export interface RangeChoseProps {
    filterName: string,
    key: number,
    min: number,
    max: number,
    defaultValue: number[],
    cancel:boolean,
    updateConditions:(key:string, value: any, checkedAll: boolean) => void,
}

export interface RangeChoseStates { 
    inputValue: number [],

}


export default class RangeChose extends React.Component<RangeChoseProps, RangeChoseStates> {
    constructor(props: RangeChoseProps) {
        super(props);
        console.log('RangeChose', props)
        this.state = {inputValue:[0,0]}
        this.onChangeInputValue = this.onChangeInputValue.bind(this)
        this.onInputValueAfterChange = this.onInputValueAfterChange.bind(this)
    }
    public init() {
    	const inputValue = this.props.defaultValue
    	this.setState({inputValue})
    	// ()=>{console.log('RangeChoseinit', this.state.inputValue)}
    }
    public componentDidMount() {
        this.init();
    }
    public componentDidUpdate(prevProps: RangeChoseProps, prevState: RangeChoseStates) {
	    // if (this.props.cancel)
	    // this.setState({inputValue:this.props.defaultValue})
	    //   this.init()
	 }
	componentWillReceiveProps(nextProps: RangeChoseProps) {
		  // You don't have to do this check first, but it can help prevent an unneeded render
		  if (nextProps.defaultValue !== this.state.inputValue && nextProps.cancel == true) {
		    this.setState({inputValue: nextProps.defaultValue});
		  }
	}

    onChangeInputValue(idx:number, value: any){
        var {inputValue}  = this.state
        const {min, max, updateConditions, filterName} = this.props
        if(typeof(value) == 'number' && inputValue){
            inputValue[idx] = value
            if(inputValue){
                var coverAll = false
                if(inputValue[0] <= min && inputValue[1] >= max)
                    coverAll = true
                updateConditions(filterName, inputValue, coverAll)
            }
        }
        else{
            inputValue = value
        }
        this.setState({inputValue})
    }
    onInputValueAfterChange(trueIdx: number, value: any){
        const {inputValue}  = this.state;
        const {filterName, updateConditions, min, max} = this.props
        if(inputValue){
            var coverAll = false
            if(inputValue[0] <= min && inputValue[1] >= max)
                coverAll = true
            updateConditions(filterName, inputValue, coverAll)
         }
    }

    public render() {
        var {min, max, filterName,  defaultValue, key} = this.props
        var {inputValue} = this.state
        if(inputValue){
        	// console.log('YES')
        	var inputValue1 = Math.floor(inputValue[0])
       		var inputValue2 = Math.ceil(inputValue[1])
        	console.log('RangeChose inputValue', inputValue)
	        return(
		            <Row>
		              <Col span={6} className='filterName'> {filterName} : </Col>
		              <Col span={4}>
		                  <InputNumber
		                    min={min}
		                    max={max}
		                    style={{ width: '50px' }}
		                    defaultValue={defaultValue? defaultValue[0]:min}
		                    value={inputValue1?inputValue1:min}
		                    onChange={this.onChangeInputValue.bind(this, 0)}
		                  />
		              </Col>
		              <Col span={10}>
		                  <Slider
		                    range
		                    key={filterName}
		                    className={filterName}
		                    min={min}
		                    max={max}
		                    value={inputValue1 && inputValue2? [inputValue1, inputValue2]:[0,100]}
		                    defaultValue={defaultValue?[defaultValue[0], defaultValue[1]]: [min, max]}
		                    onChange={this.onChangeInputValue.bind(this, 0)}
		                    onAfterChange={this.onInputValueAfterChange.bind(this, 0)}
		                />
		              </Col>
		              <Col span={3} className='rightValue'>
		                    <InputNumber
		                    min={min}
		                    max={max}
		                    style={{width: '50px' }}
		                    defaultValue={defaultValue? defaultValue[1]:max}
		                    value={inputValue2?inputValue2:max}
		                    onChange={this.onChangeInputValue.bind(this, 1)}
		                  />
		              </Col>
	           		</Row>)
	    }
	    console.log('nonono')
    }

}


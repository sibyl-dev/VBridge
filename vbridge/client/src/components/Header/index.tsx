import { FilterOutlined } from "@ant-design/icons"
import { Select, Tooltip, Button } from "antd"
import { EntitySetSchema } from "type/resource"

const { Option } = Select;

export const AppHeader = (params: {
    entitySetSchema?: EntitySetSchema,
    directIds?: string[],
    onSelectDirectId: (directId: string) => void
    entityCategoricalColor: (entityId: string) => string
}) => {
    const { entitySetSchema, onSelectDirectId, directIds, entityCategoricalColor } = params;
    return (<div style={{ height: "100%" }}>
        <span className='system-name'>VBridge</span>
        <div className='system-info'>
            <div className='system-widget'>

                <div className='legend-area'>
                    <div className="category-legend-container">
                        {entitySetSchema?.map(entity =>
                            <div className="legend-block" key={entity.entityId}>
                                <div className='legend-rect' style={{ backgroundColor: entityCategoricalColor(entity.entityId) }} />
                                <span className='legend-name'>{entity.alias || entity.entityId}</span>
                            </div>
                        )}
                        <div className="legend-block">
                            <div className='legend-rect' style={{ backgroundColor: entityCategoricalColor('Admission') }} />
                            <span className='legend-name'>{"Patient & Surgery info"}</span>
                        </div>
                    </div>
                    <div className='healthy-legend'>
                        <div className="legend-block">
                            <div className='legend-rect' style={{ backgroundColor: 'rgb(242, 142, 44)' }} />
                            <span className='legend-name'>{"High Risk"}</span>
                        </div>
                        <div className="legend-block">
                            <div className='legend-rect' style={{ backgroundColor: 'rgb(78, 121, 167)' }} />
                            <span className='legend-name'>{"Low Risk"}</span>
                        </div>
                    </div>
                </div>
                <span className='header-name'>Patient: </span>
                <div className='header-content'>
                    <Select style={{ width: 120 }} onChange={onSelectDirectId} className="patient-selector">
                        {directIds && directIds.map((id, i) =>
                            <Option value={id} key={i}>{id}</Option>
                        )}
                    </Select>
                </div>
                {/* <div className='header-content predictions'>
                  {targetSchema?.where(d => d.id !== 'complication').select(d =>
                    <Tooltip title={d.id} placement="top" key={d.id}>
                      <div className={'prediction-icon' + (target && d.id === target ? " selected" : "") +
                        ((predictions && predictions[d.id] > 0.5000) ? " active" : " inactive")}
                        onClick={() => this.selectPredictionTarget(d.id)}>
                        <span>{d.id.toUpperCase()[0]} </span>
                      </div>
                    </Tooltip>
                  )}
                </div> */}

                <span className='header-name'>#Group:</span>
                {/* <span className="header-name"> {`${patientGroup && patientGroup.ids ? patientGroup.ids.length : 0}
                    (${patientGroup ? patientGroup.labelCounts[5] : 0})`} </span> */}
                {/* <Tooltip title="Filter">
                    <Button type="primary" shape="circle" icon={<FilterOutlined />} onClick={this.showDrawer} style={{ zIndex: 1 }} />
                </Tooltip> */}
            </div>
        </div>
    </div>
    )
}
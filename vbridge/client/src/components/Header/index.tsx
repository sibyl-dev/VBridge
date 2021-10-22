import { FilterOutlined } from "@ant-design/icons"
import { Select, Tooltip, Button } from "antd"
import { EntitySetSchema, Task } from "type/resource"
import { ColorManager } from "visualization/color";

const { Option } = Select;

export const AppHeader = (params: {
    task?: Task,
    target?: string,
    entitySetSchema?: EntitySetSchema,
    directIds?: string[],
    cohortIds?: string[],
    onSelectDirectId: (directId: string) => void,
    openCohortSelector: () => void;
    colorManager?: ColorManager
}) => {
    const { entitySetSchema, onSelectDirectId, directIds, cohortIds,
        colorManager, target, task, openCohortSelector } = params;
    return (<div style={{ height: "100%" }}>
        <span className='system-name'>VBridge</span>
        <div className='system-info'>
            <div className='system-widget'>

                <div className='legend-area'>
                    <div className="category-legend-container">
                        {entitySetSchema?.map(entity =>
                            <div className="legend-block" key={entity.entityId}>
                                <div className='legend-rect' style={{
                                    backgroundColor: colorManager?.entityColor(entity.entityId)
                                }} />
                                <span className='legend-name'>{entity.alias || entity.entityId}</span>
                            </div>
                        )}
                        <div className="legend-block">
                            <div className='legend-rect' style={{
                                backgroundColor: colorManager?.entityColor('ADMISSIONS')
                            }} />
                            <span className='legend-name'>{"Patient & Surgery info"}</span>
                        </div>
                    </div>
                    <div className='label-legend-container'>
                        {target && task?.labels[target].label_extent?.map((d, i) => {
                            return <div className="legend-block" key={d}>
                                <div className='legend-rect' style={{
                                    backgroundColor: colorManager?.labelColor(target, i)
                                }} />
                                <span className='legend-name'>{d}</span>
                            </div>
                        })}
                    </div>
                </div>
                <span className='header-name'>Patient: </span>
                <div className='header-content'>
                    <Select style={{ width: 120 }} onChange={onSelectDirectId}
                        className="patient-selector">
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
                <span className="header-name"> {`${cohortIds ? cohortIds.length : 0}`} </span>
                <Tooltip title="Cohort Selector">
                    <Button type="primary" shape="circle" icon={<FilterOutlined />} onClick={openCohortSelector} style={{ zIndex: 1 }} />
                </Tooltip>
            </div>
        </div>
    </div>
    )
}
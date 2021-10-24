import { FilterOutlined } from "@ant-design/icons"
import { Select, Tooltip, Button } from "antd"
import _ from "lodash";
import { EntitySetSchema, Prediction, Task } from "type/resource"
import { ColorManager } from "visualization/color";

const { Option } = Select;

export const AppHeader = (params: {
    task?: Task,
    target?: string,
    prediction?: Prediction,
    entitySetSchema?: EntitySetSchema,
    directIds?: string[],
    cohortIds?: string[],
    onSelectDirectId: (directId: string) => void,
    openCohortSelector: () => void;
    colorManager?: ColorManager
}) => {
    const { entitySetSchema, onSelectDirectId, directIds, cohortIds,
        colorManager, target, task, openCohortSelector, prediction } = params;
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
                                backgroundColor: task && colorManager?.entityColor(task.forwardEntities[0])
                            }} />
                            <span className='legend-name'>{"Demographics Info"}</span>
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
                <div className='header-content predictions'>
                    {task && Object.keys(task.labels).map(d => {
                        const predProb: number | undefined = prediction && prediction[d];
                        const pred = prediction && prediction[d] > 0.5000;
                        const labelExtent = task.labels[d].label_extent;
                        return <Tooltip title={`The patient's ${d} is predicted as ${pred === undefined ? '-' :
                            labelExtent![+ pred]} (${predProb === undefined ? '-' : _.round(predProb, 3)}).`}
                            placement="top" key={d}>
                            <div className={'prediction-icon' + (d === target ? " selected" : "") +
                                (pred ? " active" : " inactive")}>
                                <span>{d.toUpperCase()[0]} </span>
                            </div>
                        </Tooltip>
                    })}
                </div>

                <span className='header-name'>#Group:</span>
                <span className="header-name"> {`${cohortIds ? cohortIds.length : 0}`} </span>
                <Tooltip title="Cohort Selector">
                    <Button type="primary" shape="circle" icon={<FilterOutlined />}
                        onClick={openCohortSelector} style={{ zIndex: 1 }} />
                </Tooltip>
            </div>
        </div>
    </div>
    )
}
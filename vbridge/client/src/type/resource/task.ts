export interface Label {
    label_type: 'boolean', // TODO: support numerical and nominal types in the future
    label_extent?: string[]
}

export interface Task {
    taskId: string,
    shortDesc: string,
    targetEntity: string,
    backwardEntities: string[],
    forwardEntities: string[],
    labels: Record<string, Label>
}
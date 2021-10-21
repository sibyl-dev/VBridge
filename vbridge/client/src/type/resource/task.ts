export interface Label {
    label_type: 'boolean', // TODO: support numerical (regression) and nominal (multi-class) types in the future
    label_extent?: string[]
}

export interface CategoricalVariable {
    name: string,
    type: 'categorical'
    extent: string[]
}

export interface NumericalVariable {
    name: string,
    type: 'numerical'
    extent: [number, number]
}

export type SelectorVariable = CategoricalVariable | NumericalVariable;

export function isCategoricalVariable(variable: SelectorVariable): variable is CategoricalVariable {
    return variable.type === 'categorical'
}

export interface Task {
    taskId: string,
    shortDesc: string,
    targetEntity: string,
    backwardEntities: string[],
    forwardEntities: string[],
    labels: Record<string, Label>,
    selectorVars: SelectorVariable[]
}
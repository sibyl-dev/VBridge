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
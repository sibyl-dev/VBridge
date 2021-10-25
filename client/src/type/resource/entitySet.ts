export type ItemDict = Record<string, string>;

export interface EntitySchema {
    entityId: string,
    alias?: string,
    time_index?: string,
    item_index?: string,
    value_indexes?: string[],
    types?: ('numerical' | 'categorical' | 'timestamp')[],
    item_dict?: ItemDict
}

export type EntitySetSchema = EntitySchema[];

export type StatValues = {
    mean: number,
    std: number,
    count: number,
    ci95: [number, number],
}

// columnId -> itemId -> reference values
export type ReferenceValues = Record<string, Record<string, StatValues>>;

export type ReferenceValueResponse = Record<string, ReferenceValues>;
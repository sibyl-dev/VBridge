export interface FeatureMeta {
    name: string,
    alias: string,
    primitive: string,
    end_entity: string
    where_item?: [string, string]
}

export interface Feature extends FeatureMeta{
    value: number | string | Array<any>
    shapValues: (target: string) => number
}
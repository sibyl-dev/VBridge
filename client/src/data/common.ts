import * as _ from "lodash"
import { AssertionError } from "assert";

export function distinct<T>(value: T, index: number, self: Array<T>) {
    return self.indexOf(value) === index;
}

export const getTextWidth = function () {
    const canvas = document.createElement("canvas");
    const func = (text: string, font: string = 'bold 14pt Arial'): number => {
        // re-use canvas object for better performance
        const context = canvas.getContext("2d")!;
        context.font = font;
        const metrics = context.measureText(text);
        return metrics.width;
    }
    return func;
}();

export const shallowCompare = (v: any, o: any, excludeKeys?: Set<string>, debug: boolean = false) => {
    for (let key in v) {
        if (excludeKeys && excludeKeys.has(key)) continue;
        if (!(key in o) || v[key] !== o[key]) {
            if (debug) console.debug(`key ${key}`);
            return false;
        }
    }

    for (let key in o) {
        if (excludeKeys && excludeKeys.has(key)) continue;
        if (!(key in v) || v[key] !== o[key]) {
            if (debug) console.debug(`key ${key}`);
            return false;
        }
    }

    return true;
};

export function arrayShallowCompare<T>(array1?: Array<T>, array2?: Array<T>) {
    if (array1 === undefined)
        return array2 === undefined;
    else if (array2 === undefined)
        return false;
    else if (array1.length !== array2.length)
        return false;
        
    let flag = true;
    // the order should be the same
    array1.forEach((d, i) => {
        if (array2[i] != d)
            flag = false
    })
    return flag;
}

export function decile2precision(max: number, decile: number = 0): number {
    if (max >= 1)
        return Math.ceil(Math.log10(max)) + decile;
    else
        return decile;
}

export function number2string(x: number, precision: number = 4): string {
    if (Number.isInteger(x)) return x.toFixed(0);
    return x.toPrecision(precision);
}

export function assert(cond: any, message: any = ""): asserts cond {
    if (cond) return;
    throw new AssertionError(message);
}

export type WithDefault<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export function notEmpty<T>(value: T | null | undefined): value is T {
    return value !== null && value !== undefined
}

export function transMax<T>(matrix: T[][]): T[][] {
    const rows = matrix.length;
    if (rows < 1)
        throw Error("Matrix empty")
    const cols = matrix[0].length;
    const ret = _.range(cols).map((d, i) => _.range(rows).map((d, j) => matrix[j][i]));
    return ret;
}

export function confidenceInterval(data: number[], z_value: number) {
    if (data.length == 0)
        return [0, 0]
    const mean = _.mean(data);
    const std = Math.sqrt(data.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b));
    const n = data.length;
    const delta = std / Math.sqrt(data.length);
    return [mean - z_value * delta, mean + z_value * delta];
}

export function confidenceThresholds(data: number[]) {
    // confidence interval 90% 95% 99%
    const z_values = [1.645, 1.960, 2.576];
    return _.sortBy(z_values.map(z => confidenceInterval(data, z)).flat());
}

export const isDefined = <T>(input: T | undefined | null): input is T => {
    return typeof input !== 'undefined' && input !== null;
};

export type ReferenceValue = {
    mean: number,
    std: number,
    count: number,
    ci95: [number, number],
}

export type ReferenceValueDict = (itemName: string) => (ReferenceValue | undefined);

export function getReferenceValue(data: number[]): ReferenceValue {
    if(data.length==0){
       return {
        mean: 0,
        std: 0,
        count: 0,
        ci95: [0,0]
        }
    }
    const mean = _.mean(data);
    const std = Math.sqrt(data.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b)) / Math.sqrt(data.length);
    const count = data.length;
    let ci95 = [0, 0] as [number, number];
    if (count > 0) {
        const delta = std * 1.960;
        ci95 = [mean - delta, mean + delta];
    }
    return {
        mean: mean,
        std: std,
        count: count,
        ci95: ci95
    }
}

export function timeDeltaPrinter(startTime: Date, endTime: Date) {
    const deltaMinute = (endTime.getTime() - startTime.getTime()) / 1000 / 60;
    if (deltaMinute < 60 * 3) {
        const hour = Math.floor(deltaMinute / 60);
        const minute = deltaMinute % 60;
        return (hour > 0) ? `${hour}h${minute}m` : `${minute}m`;
    }
    else {
        const deltaHour = Math.floor(deltaMinute / 60);
        if (deltaHour < 24 * 3) {
            const day = Math.floor(deltaHour / 24);
            const hour = deltaHour % 24;
            return (day > 0) ? `${day}d${hour}h` : `${hour}h`;
        }
        else {
            return `${Math.floor(deltaHour / 24)}d`
        }
    }
}
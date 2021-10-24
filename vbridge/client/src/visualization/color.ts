import _ from "lodash";
import { Task } from "type/resource";

function colors(specifier: string) {
    let n = specifier.length / 6 | 0, colors: string[] = new Array(n), i = 0;
    while (i < n) colors[i] = "#" + specifier.slice(i * 6, ++i * 6);
    return colors;
}

export const schemeTableau10 = colors("4e79a7f28e2ce1575976b7b259a14fedc949af7aa1ff9da79c755fbab0ab");

export const defaultCategoricalColor = (i: number) => schemeTableau10[i % schemeTableau10.length];

export interface IColorManager {
    task: Task;
    entityColor: (entityId: string) => string;
    labelColor: (labelId: string, labelValue: string | number) => string;
}

export class ColorManager implements IColorManager {
    task: Task;
    labelColorCount: number;

    constructor(task: Task) {
        this.task = task;
        this.labelColorCount = Math.max(4, _.max(Object.keys(task.labels).map(k =>
            task.labels[k].label_extent?.length)) || 0);
    }

    entityColor(entityId: string) {
        if (this.task.forwardEntities.includes(entityId)) {
            return defaultCategoricalColor(8);
        }
        else if (this.task.backwardEntities.includes(entityId)) {
            return defaultCategoricalColor(this.task.backwardEntities.indexOf(entityId)
                + this.labelColorCount);
        }
        else {
            return "#aaa"
        }
    }

    labelColor(labelId: string, labelValue: string | number) {
        if (this.task.labels[labelId].label_type === 'boolean') {
            return defaultCategoricalColor(labelValue >= 0.5 ? 1 : 0);
        }
        else {
            throw("Not Implemented Error");
        }
    }
}
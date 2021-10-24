export type SHAP = Record<string, number>;

export type WhatIfSHAP = Record<string, { prediction: number, shap: number }>;

export type Segment = {
    startTime: Date,
    endTime: Date,
    contriSum: number,
    maxValue: number,
    minValue: number
}

export type SignalExplanation = {
    featureName: string,
    segments: Segment
}[]
export type PatientMeta = {
    subjectId: number,
    ADMITTIME: Date,
    SURGERY_BEGIN_TIME: Date,
    SURGERY_END_TIME: Date,
    DOB: Date,
    GENDER: string,
    days: number,
}

export type PatientGroup = { 
    ids: number[],
    labelCounts: number[], 
}
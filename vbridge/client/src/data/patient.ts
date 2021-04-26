export type PatientMeta = {
    subjectId: number,
    AdmitTime: Date,
    SurgeryBeginTime: Date,
    SurgeryEndTime: Date,
    DOB: Date,
    GENDER: string,
    days: number,
}

export type PatientGroup = { 
    ids: number[],
    labelCounts: number[], 
}
export type PatientMeta = {
    subjectId: number,
    AdmitTime: Date,
    SurgeryBeginTime: Date,
    SurgeryEndTime: Date,
    DOB: string,
    GENDER: string,
}

export type PatientGroup = { 
    ids: number[],
    labelCounts: number[], 
}
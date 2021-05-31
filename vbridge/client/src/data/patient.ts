export type PatientStatics = {
    SUBJECT_ID: number,
    ADMITTIME: Date,
    GENDER: string,
    SURGERY_BEGIN_TIME: Date,
    SURGERY_END_TIME: Date,
    ageInDays?: number,
};

export type patientTemporal = any;

export type PatientGroup = { 
    ids: number[],
    labelCounts: number[], 
};
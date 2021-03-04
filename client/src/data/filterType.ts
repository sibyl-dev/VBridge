export type filterType = {
    'GENDER': string[],
    'ADMISSION_DEPARTMENT': string[], 
    'INSURANCE': string[], 

    'LANGUAGE': string[], 
    'RELIGION': string[], 
    'MARITAL_STATUS': string[],

    'ETHNICITY': string[], 
    'DIAGNOSIS': string[], 
    'ICD10_CODE_CN': string[],
    'SURGERY_NAME': string[],
    'ANES_METHOD': string[],
    'SURGERY_POSITION': string[],
    'Height': number[],
    'Weight': number[],

    // 'Preoperative oxygen saturation (%)': number[],
    // 'Oxygen saturation (%)': number[],

    'Surgical time (minutes)': number[],

    // 'CPB time (minutes)': number[],
    // 'Aortic cross-clamping time (times)': number[],

    'complication': number[],
    'lung complication': number[],
    'cardiac complication': number[],
    'arrhythmia complication': number[],
    'infectious complication': number[],
    'other complication': number[],
    'Age': number[],
}

entity_configs = {
    'PATIENTS': {
        'index': 'SUBJECT_ID',
    },
    'ADMISSIONS': {
        'index': 'HADM_ID',
        'identifiers': ['SUBJECT_ID'],
        'time_index': 'ADMITTIME',
        'secondary_index': {
            'DISCHTIME': ['DISCHARGE_DEPARTMENT', 'HOSPITAL_EXPIRE_FLAG', 'DIAGNOSIS',
                          'EDOUTTIME'],
            'DEATHTIME': ['DISCHARGE_DEPARTMENT', 'HOSPITAL_EXPIRE_FLAG', 'DIAGNOSIS',
                          'EDOUTTIME'],
        },
    },
    'ICUSTAYS': {
        'index': 'ICUSTAY_ID',
        'identifiers': ['SUBJECT_ID', 'HADM_ID'],
        'time_index': 'INTIME',
        'secondary_index': {
            'OUTTIME': ['LAST_CAREUNIT', 'LAST_WARDID', 'LOS']
        }
    },
    'DIAGNOSES_ICD': {
        'identifiers': ['SUBJECT_ID', 'HADM_ID', 'ICD10_CODE_CN'],
    },
    'SURGERY_INFO': {
        'identifiers': ['SUBJECT_ID', 'HADM_ID'],
        'time_index': 'SURGERY_BEGIN_TIME',
        'secondary_index': {
            # 'ANES_END_TIME': [],
            # 'SURGERY_BEGIN_TIME': [],
            'SURGERY_END_TIME': []
        },
    },
    'SURGERY_VITAL_SIGNS': {
        'identifiers': ['SUBJECT_ID', 'HADM_ID', 'ITEMID', 'OPER_ID'],
        'time_index': 'MONITOR_TIME',
        'item_index': 'ITEMID',
        'interesting_values': 'ALL',
        'value_indexes': ['VALUE'],
        'alias': 'Vital Signs',
    },
    'EMR_SYMPTOMS': {
        'identifiers': ['SUBJECT_ID', 'HADM_ID', 'EMR_ID'],
        'time_index': 'RECORDTIME',
    },
    'LABEVENTS': {
        'identifiers': ['SUBJECT_ID', 'HADM_ID', 'ITEMID'],
        'time_index': 'CHARTTIME',
        'item_index': 'ITEMID',
        'value_indexes': ['VALUENUM'],
        'interesting_values': 45,
        'alias': 'Lab Tests',
    },
    'MICROBIOLOGYEVENTS': {
        'identifiers': ['SUBJECT_ID', 'HADM_ID', 'SPEC_ITEMID'],
        'time_index': 'CHARTTIME',
        'alias': 'Microbiology Tests',
    },
    'OR_EXAM_REPORTS': {
        'identifiers': ['SUBJECT_ID', 'HADM_ID'],
        'time_index': 'REPORTTIME'
    },
    'CHARTEVENTS': {
        'identifiers': ['SUBJECT_ID', 'HADM_ID', 'ITEMID'],
        'time_index': 'CHARTTIME',
        'item_index': 'ITEMID',
        'value_indexes': ['VALUENUM'],
        'interesting_values': 'ALL',
        'alias': 'Chart Events',
    },
    'INPUTEVENTS': {
        'identifiers': ['SUBJECT_ID', 'HADM_ID', 'ICUSTAY_ID'],
        'time_index': 'CHARTTIME',
        'value_indexes': ['VALUE'],
        'alias': 'Inputs',
    },
    'OUTPUTEVENTS': {
        'identifiers': ['SUBJECT_ID', 'HADM_ID', 'ITEMID'],
        'time_index': 'CHARTTIME',
        'item_index': 'ITEMID',
        'value_indexes': ['VALUE'],
        'alias': 'Outputs',
    },
    'PRESCRIPTIONS': {
        'identifiers': ['SUBJECT_ID', 'HADM_ID'],
        'time_index': 'STARTDATE',
        'secondary_index': {
            'ENDDATE': []
        },
        'item_index': 'DRUG_NAME',
        'alias': 'Prescriptions',
    },
    'D_ITEMS': {
        'index': 'ITEMID',
    },
    'D_LABITEMS': {
        'index': 'ITEMID',
    },
    'D_ICD_DIAGNOSES': {
        'index': 'ICD10_CODE_CN',
    }
}

relationships = [
    # PATIENTS
    ('PATIENTS', 'SUBJECT_ID', 'ADMISSIONS', 'SUBJECT_ID'),
    # ADMISSIONS
    ('ADMISSIONS', 'HADM_ID', 'ICUSTAYS', 'HADM_ID'),
    ('ADMISSIONS', 'HADM_ID', 'DIAGNOSES_ICD', 'HADM_ID'),
    ('ADMISSIONS', 'HADM_ID', 'EMR_SYMPTOMS', 'HADM_ID'),
    ('ADMISSIONS', 'HADM_ID', 'LABEVENTS', 'HADM_ID'),
    ('ADMISSIONS', 'HADM_ID', 'MICROBIOLOGYEVENTS', 'HADM_ID'),
    ('ADMISSIONS', 'HADM_ID', 'OR_EXAM_REPORTS', 'HADM_ID'),
    ('ADMISSIONS', 'HADM_ID', 'SURGERY_INFO', 'HADM_ID'),
    ('ADMISSIONS', 'HADM_ID', 'CHARTEVENTS', 'HADM_ID'),
    ('ADMISSIONS', 'HADM_ID', 'OUTPUTEVENTS', 'HADM_ID'),
    ('ADMISSIONS', 'HADM_ID', 'PRESCRIPTIONS', 'HADM_ID'),
    ('ADMISSIONS', 'HADM_ID', 'SURGERY_VITAL_SIGNS', 'HADM_ID'),
    # ICUSTAYS
    ('ICUSTAYS', 'ICUSTAY_ID', 'INPUTEVENTS', 'ICUSTAY_ID'),
    # DICTS
    ('D_ITEMS', 'ITEMID', 'CHARTEVENTS', 'ITEMID'),
    ('D_ITEMS', 'ITEMID', 'OUTPUTEVENTS', 'ITEMID'),
    ('D_ITEMS', 'ITEMID', 'MICROBIOLOGYEVENTS', 'SPEC_ITEMID'),
    ('D_ITEMS', 'ITEMID', 'MICROBIOLOGYEVENTS', 'ORG_ITEMID'),
    ('D_ITEMS', 'ITEMID', 'MICROBIOLOGYEVENTS', 'AB_ITEMID'),
    ('D_ITEMS', 'ITEMID', 'SURGERY_VITAL_SIGNS', 'ITEMID'),
    ('D_LABITEMS', 'ITEMID', 'LABEVENTS', 'ITEMID'),
    ('D_ICD_DIAGNOSES', 'ICD10_CODE_CN', 'DIAGNOSES_ICD', 'ICD10_CODE_CN'),
]

ignore_variables = {
    'PATIENTS': ['ROW_ID', 'EXPIRE_FLAG', 'DOD', 'SUBJECT_ID'],
    'ADMISSIONS': ['ROW_ID', 'HADM_ID', 'SUBJECT_ID', 'HAS_CHARTEVENTS_DATA', 'LANGUAGE',
                   'RELIGION', 'MARITAL_STATUS', 'ETHNICITY', 'ADMISSION_DEPARTMENT', 'INSURANCE'],
    'ICUSTAYS': ['ROW_ID', 'HADM_ID', 'ICUSTAY_ID', 'SUBJECT_ID'],
    'SURGERY_INFO': ['ROW_ID', 'HADM_ID', 'SUBJECT_ID', 'VISIT_ID', 'OPER_ID',
                     'Preoperative oxygen saturation (%)', 'Oxygen saturation (%)'],
    'DIAGNOSES_ICD': ['ROW_ID', 'HADM_ID', 'SUBJECT_ID'],
    'SURGERY_VITAL_SIGNS': ['ROW_ID', 'HADM_ID', 'SUBJECT_ID', 'VISIT_ID', 'OPER_ID', 'ITEM_NO'],
    'EMR_SYMPTOMS': ['ROW_ID', 'HADM_ID', 'SUBJECT_ID', 'EMR_ID', 'SYMPTOM_NAME_CN'],
    'LABEVENTS': ['ROW_ID', 'HADM_ID', 'SUBJECT_ID', 'VALUEUOM', 'VALUE', 'CHARTTIME'],
    'MICROBIOLOGYEVENTS': ['ROW_ID', 'HADM_ID', 'SUBJECT_ID', 'AB_ITEMID', 'ORG_ITEMID',
                           'SPEC_ITEMID'],
    'OR_EXAM_REPORTS': ['ROW_ID', 'HADM_ID', 'SUBJECT_ID', 'REPORTTIME'],
    'CHARTEVENTS': ['ROW_ID', 'SUBJECT_ID', 'HADM_ID', 'ICUSTAY_ID', 'VALUE', 'VALUEUOM',
                    'STORETIME'],
    'INPUTEVENTS': ['ROW_ID', 'HADM_ID', 'ICUSTAY_ID', 'SUBJECT_ID'],
    'OUTPUTEVENTS': ['ROW_ID', 'HADM_ID', 'ICUSTAY_ID', 'ITEMID', 'SUBJECT_ID'],
    'PRESCRIPTIONS': ['ROW_ID', 'HADM_ID', 'ICUSTAY_ID', 'SUBJECT_ID', 'DOSE_UNIT_RX',
                      'PROD_STRENGTH', 'DRUG_NAME_GENERIC', 'DOSE_UNIT_RX', 'DRUG_FORM'],
    'D_ITEMS': ['ROW_ID', 'ITEMID', 'UNITNAME', 'LINKSTO', 'LABEL_CN', 'CATEGORY'],
    'D_LABITEMS': ['ROW_ID', 'ITEMID', 'LABEL_CN'],
    'D_ICD_DIAGNOSES': ['ROW_ID']
}

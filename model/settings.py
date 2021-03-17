RELATIONSHIPS = [
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
    # SURGERYS
    ('SURGERY_INFO', 'UNI_OPER_ID', 'SURGERY_VITAL_SIGNS', 'UNI_OPER_ID'),
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

complication_type = ['complication', 'lung complication','cardiac complication','arrhythmia complication','infectious complication','other complication']
fm_category_name= [ 'SURGERY_NAME','SURGERY_POSITION',
                    'ADMISSIONS.ADMISSION_DEPARTMENT','ADMISSIONS.INSURANCE','ADMISSIONS.LANGUAGE',
                    'ADMISSIONS.RELIGION','ADMISSIONS.MARITAL_STATUS','ADMISSIONS.ETHNICITY',
                    'ADMISSIONS.ICD10_CODE_CN','ADMISSIONS.HAS_CHARTEVENTS_DATA','ADMISSIONS.PATIENTS.GENDER',]
META_INFO = {
    'PATIENTS': {
        'index': 'SUBJECT_ID',
        'types': {'SUBJECT_ID': 'int', 'EXPIRE_FLAG': 'bool'},
    },
    'ADMISSIONS': {
        'index': 'HADM_ID',
        'foreign_index': ['SUBJECT_ID'],
        'types': {'SUBJECT_ID': 'int', 'HADM_ID': 'int'},
        'time_index': 'ADMITTIME',
        'secondary_index': {
            'DISCHTIME': ['DISCHARGE_DEPARTMENT', 'HOSPITAL_EXPIRE_FLAG', 'DIAGNOSIS', 'EDOUTTIME'],
            'DEATHTIME': ['DISCHARGE_DEPARTMENT', 'HOSPITAL_EXPIRE_FLAG', 'DIAGNOSIS', 'EDOUTTIME'],
        },
    },
    'ICUSTAYS': {
        'index': 'ICUSTAY_ID',
        'foreign_index': ['SUBJECT_ID', 'HADM_ID'],
        'types': {'HADM_ID': 'int', 'ICUSTAY_ID': 'int', 'FIRST_WARDID': 'str',
                  'LAST_WARDID': 'str'},
        'time_index': 'INTIME',
        'secondary_index': {
            'OUTTIME': ['LAST_CAREUNIT', 'LAST_WARDID', 'LOS']
        }
    },
    'SURGERY_INFO': {
        'index': 'UNI_OPER_ID',
        'foreign_index': ['SUBJECT_ID', 'HADM_ID'],
        'types': {'HADM_ID': 'int', 'VISIT_ID': 'str', 'OPER_ID': 'str'},
        'time_index': 'ANES_START_TIME',
        'secondary_index': {
            'ANES_END_TIME': [],
            'SURGERY_BEGIN_TIME': [],
            'SURGERY_END_TIME': []
        },
    },
    'DIAGNOSES_ICD': {
        'foreign_index': ['SUBJECT_ID', 'HADM_ID', 'ICD10_CODE_CN'],
        'types': {'ICD10_CODE_CN': 'str', 'HADM_ID': 'int'},
    },
    'SURGERY_VITAL_SIGNS': {
        'foreign_index': ['SUBJECT_ID', 'HADM_ID', 'ITEMID', 'OPER_ID'],
        'types': {'HADM_ID': 'int', 'ITEMID': 'str', 'VISIT_ID': 'int',
                  'OPER_ID': 'int', 'ITEM_NO': 'int'},
        'time_index': 'MONITOR_TIME',
        'item_index': 'ITEMID',
        'value_indexes': ['VALUE'],
        'alias': 'Vital Signs',
    },
    'EMR_SYMPTOMS': {
        'foreign_index': ['SUBJECT_ID', 'HADM_ID', 'EMR_ID'],
        'types': {'HADM_ID': 'int'},
        'time_index': 'RECORDTIME',
    },
    'LABEVENTS': {
        'foreign_index': ['SUBJECT_ID', 'HADM_ID', 'ITEMID'],
        'types': {'HADM_ID': 'int', 'ITEMID': 'str'},
        'time_index': 'CHARTTIME',
        'item_index': 'ITEMID',
        'value_indexes': ['VALUE'],
        'alias': 'Lab Tests',
    },
    'MICROBIOLOGYEVENTS': {
        'foreign_index': ['SUBJECT_ID', 'HADM_ID', 'SPEC_ITEMID'],
        'types': {'HADM_ID': 'int', 'SPEC_ITEMID': 'str',
                  'ORG_ITEMID': 'str', 'AB_ITEMID': 'str'},
        'time_index': 'CHARTTIME',
        'alias': 'Microbiology Tests',
    },
    'OR_EXAM_REPORTS': {
        'foreign_index': ['SUBJECT_ID', 'HADM_ID'],
        'types': {'HADM_ID': 'int'},
        'time_index': 'REPORTTIME'
    },
    'CHARTEVENTS': {
        'foreign_index': ['SUBJECT_ID', 'HADM_ID', 'ITEMID'],
        'types': {'ITEMID': 'str'},
        'time_index': 'CHARTTIME',
        'item_index': 'ITEMID',
        'value_indexes': ['VALUE'],
        'alias': 'Chart Signs',
    },
    'INPUTEVENTS': {
        'foreign_index': ['SUBJECT_ID', 'HADM_ID', 'ICUSTAY_ID'],
        'types': {'ICUSTAY_ID': 'int'},
        'time_index': 'CHARTTIME',
        'value_indexes': ['VALUE'],
        'alias': 'Inputs',
    },
    'OUTPUTEVENTS': {
        'foreign_index': ['SUBJECT_ID', 'HADM_ID', 'ITEMID'],
        'types': {'ITEMID': 'str'},
        'time_index': 'CHARTTIME',
        'item_index': 'ITEMID',
        'value_indexes': ['VALUE'],
        'alias': 'Outputs',
    },
    'PRESCRIPTIONS': {
        'foreign_index': ['SUBJECT_ID', 'HADM_ID'],
        'time_index': 'STARTDATE',
        'secondary_index': {
            'ENDDATE': []
        },
        'item_index': 'DRUG_NAME',
        'alias': 'Prescriptions',
    },
    'D_ITEMS': {
        'index': 'ITEMID',
        'types': {'ITEMID': 'str'},
    },
    'D_LABITEMS': {
        'index': 'ITEMID',
        'types': {'ITEMID': 'str'},
    },
    'D_ICD_DIAGNOSES': {
        'index': 'ICD10_CODE_CN',
        'types': {'ICD10_CODE_CN': 'str'},
    }
}

ignore_variables = {
    'PATIENTS': ['ROW_ID', 'EXPIRE_FLAG', 'DOD', 'SUBJECT_ID', 'LANGUAGE', 'RELIGION', 'MARITAL_STATUS', 'ETHNICITY'],
    'ADMISSIONS': ['ROW_ID', 'HADM_ID', 'SUBJECT_ID', 'HAS_CHARTEVENTS_DATA'],
    'ICUSTAYS': ['ROW_ID', 'HADM_ID', 'ICUSTAY_ID', 'SUBJECT_ID'],
    'SURGERY_INFO': ['ROW_ID', 'HADM_ID', 'SUBJECT_ID', 'VISIT_ID', 'OPER_ID'],
    'DIAGNOSES_ICD': ['ROW_ID', 'HADM_ID', 'SUBJECT_ID'],
    'SURGERY_VITAL_SIGNS': ['ROW_ID', 'HADM_ID', 'SUBJECT_ID', 'VISIT_ID', 'OPER_ID', 'ITEM_NO'],
    'EMR_SYMPTOMS': ['ROW_ID', 'HADM_ID', 'SUBJECT_ID', 'EMR_ID', 'SYMPTOM_NAME_CN'],
    'LABEVENTS': ['ROW_ID', 'HADM_ID', 'SUBJECT_ID', 'VALUEUOM', 'CHARTTIME'],
    'MICROBIOLOGYEVENTS': ['ROW_ID', 'HADM_ID', 'SUBJECT_ID', 'AB_ITEMID', 'ORG_ITEMID',
                           'SPEC_ITEMID'],
    'OR_EXAM_REPORTS': ['ROW_ID', 'HADM_ID', 'SUBJECT_ID', 'REPORTTIME'],
    'CHARTEVENTS': ['ROW_ID', 'SUBJECT_ID', 'HADM_ID', 'ICUSTAY_ID', 'VALUEUOM', 'STORETIME'],
    'INPUTEVENTS': ['ROW_ID', 'HADM_ID', 'ICUSTAY_ID', 'SUBJECT_ID'],
    'OUTPUTEVENTS': ['ROW_ID', 'HADM_ID', 'ICUSTAY_ID', 'ITEMID', 'SUBJECT_ID'],
    'PRESCRIPTIONS': ['ROW_ID', 'HADM_ID', 'ICUSTAY_ID', 'SUBJECT_ID', 'DOSE_UNIT_RX',
                      'PROD_STRENGTH', 'DRUG_NAME_GENERIC', 'DOSE_UNIT_RX', 'DRUG_FORM'],
    'D_ITEMS': ['ROW_ID', 'ITEMID', 'UNITNAME', 'LINKSTO', 'LABEL_CN', 'CATEGORY'],
    'D_LABITEMS': ['ROW_ID', 'ITEMID', 'LABEL_CN'],
    'D_ICD_DIAGNOSES': ['ROW_ID']
}

identifier_variables = {
    'PATIENTS': ['ROW_ID', 'SUBJECT_ID', 'EXPIRE_FLAG', 'DOD'],
    'ADMISSIONS': ['ROW_ID', 'HADM_ID', 'SUBJECT_ID'],
    'ICUSTAYS': ['ROW_ID', 'HADM_ID', 'ICUSTAY_ID', 'SUBJECT_ID'],
    'SURGERY_INFO': ['ROW_ID', 'HADM_ID', 'SUBJECT_ID', 'VISIT_ID', 'OPER_ID', 'UNI_OPER_ID'],
    'DIAGNOSES_ICD': ['ROW_ID', 'HADM_ID', 'SUBJECT_ID'],
    'SURGERY_VITAL_SIGNS': ['ROW_ID', 'HADM_ID', 'SUBJECT_ID', 'VISIT_ID', 'OPER_ID',
                            'UNI_OPER_ID'],
    'EMR_SYMPTOMS': ['ROW_ID', 'HADM_ID', 'SUBJECT_ID', 'EMR_ID'],
    'LABEVENTS': ['ROW_ID', 'HADM_ID', 'SUBJECT_ID', 'VALUENUM'],
    'MICROBIOLOGYEVENTS': ['ROW_ID', 'HADM_ID', 'SUBJECT_ID'],
    'OR_EXAM_REPORTS': ['ROW_ID', 'HADM_ID', 'SUBJECT_ID'],
    'CHARTEVENTS': ['ROW_ID', 'SUBJECT_ID', 'HADM_ID', 'ICUSTAY_ID'],
    'INPUTEVENTS': ['ROW_ID', 'SUBJECT_ID', 'HADM_ID', 'ICUSTAY_ID'],
    'OUTPUTEVENTS': ['ROW_ID', 'SUBJECT_ID', 'HADM_ID', 'ICUSTAY_ID'],
    'PRESCRIPTIONS': ['ROW_ID', 'SUBJECT_ID', 'HADM_ID', 'ICUSTAY_ID'],
    'D_ITEMS': ['ROW_ID', 'ITEMID'],
    'D_LABITEMS': ['ROW_ID', 'ITEMID'],
    'D_ICD_DIAGNOSES': ['ROW_ID']
}

interesting_info_meta = {
    'PATIENTS': ['Age', 'GENDER', 'Height', 'Weight',  'LANGUAGE', 'RELIGION', 'MARITAL_STATUS', 'ETHNICITY'],
    'ADMISSIONS': [
                    'ADMITTIME', 'ADMISSION_DEPARTMENT', 
                    'INSURANCE', 'EDREGTIME', 'DIAGNOSIS', 'ICD10_CODE_CN'],
    'SURGERY_INFO': ['ANES_START_TIME',
                      'ANES_END_TIME',
                      'SURGERY_BEGIN_TIME',
                      'SURGERY_END_TIME',
                      'SURGERY_NAME',
                      'ANES_METHOD',
                      'SURGERY_POSITION',
                      # 'Height',
                      # 'Weight',
                      'Preoperative oxygen saturation (%)',
                      'Oxygen saturation (%)',
                      'Surgical time (minutes)',
                      'CPB time (minutes)',
                      'Aortic cross-clamping time (times)',
                      'complication',
                      'lung complication',
                      'cardiac complication',
                      'arrhythmia complication',
                      'infectious complication',
                      'other complication',
                      # 'Age'
                      ],
}


filter_variable = [ 'Height', 'Weight', 'Surgical time (minutes)', 'GENDER', 'Age', 'SURGERY_NAME',  ]
filter_variable1 = {
    'PATIENTS': ['GENDER'],
    'ADMISSIONS':[ 'LANGUAGE', 'RELIGION', 'MARITAL_STATUS', 'ETHNICITY', 'ADMISSION_DEPARTMENT', 'INSURANCE', 'DIAGNOSIS', 'ICD10_CODE_CN',],
    'SURGERY_INFO': [ 'Age', 'Height', 'Weight', 
                    'SURGERY_NAME',
                  'ANES_METHOD',
                  'SURGERY_POSITION',
                  # 'Preoperative oxygen saturation (%)',
                  # 'Oxygen saturation (%)',
                  'Surgical time (minutes)',
                  # 'CPB time (minutes)',
                  # 'Aortic cross-clamping time (times)',
                  'complication',
                  'lung complication',
                  'cardiac complication',
                  'arrhythmia complication',
                  'infectious complication',
                  'other complication',]
}

interesting_variables = {'PATIENTS': ['GENDER', 'DOB'],
 'ADMISSIONS': ['ADMITTIME', 'ADMISSION_DEPARTMENT', 
  'INSURANCE', 'LANGUAGE', 'RELIGION', 'MARITAL_STATUS',
  'ETHNICITY', 'EDREGTIME', 'DIAGNOSIS', 'ICD10_CODE_CN'],
 'ICUSTAYS': ['FIRST_CAREUNIT', 'LAST_CAREUNIT', 'FIRST_WARDID',
  'LAST_WARDID', 'INTIME', 'OUTTIME', 'LOS'],
 'SURGERY_INFO': ['ANES_START_TIME',
  'ANES_END_TIME',
  'SURGERY_BEGIN_TIME',
  'SURGERY_END_TIME',
  'SURGERY_NAME',
  'ANES_METHOD',
  'SURGERY_POSITION',
  'Height',
  'Weight',
  'Preoperative oxygen saturation (%)',
  'Oxygen saturation (%)',
  'Surgical time (minutes)',
  'CPB time (minutes)',
  'Aortic cross-clamping time (times)',
  'complication',
  'lung complication',
  'cardiac complication',
  'arrhythmia complication',
  'infectious complication',
  'other complication',
  'Age'],
 'DIAGNOSES_ICD': ['SEQ_NUM', 'ICD10_CODE_CN', 'Diag_Category'],
 'SURGERY_VITAL_SIGNS': ['ITEM_NO', 'ITEMID', 'VALUE', 'MONITOR_TIME'],
 'EMR_SYMPTOMS': ['SYMPTOM_NAME_CN', 'SYMPTOM_NAME', 'SYMPTOM_ATTRIBUTE', 'RECORDTIME'],
 'LABEVENTS': ['ITEMID', 'VALUE', 'VALUEUOM', 'FLAG', 'CHARTTIME'],
 'MICROBIOLOGYEVENTS': ['SPEC_ITEMID', 'SPEC_TYPE_DESC', 'ORG_ITEMID',
  'ORG_NAME', 'AB_ITEMID', 'AB_NAME', 'DILUTION_TEXT', 'DILUTION_COMPARISON',
  'DILUTION_VALUE', 'INTERPRETATION', 'CHARTTIME'],
 'OR_EXAM_REPORTS': ['EXAMTIME', 'REPORTTIME', 'EXAM_ITEM_TYPE_NAME',
  'EXAM_ITEM_NAME', 'EXAM_PART_NAME'],
 'CHARTEVENTS': ['ITEMID', 'VALUE', 'VALUENUM', 'VALUEUOM', 'CHARTTIME'],
 'INPUTEVENTS': ['AMOUNT', 'AMOUNTUOM', 'CHARTTIME'],
 'OUTPUTEVENTS': ['ITEMID', 'VALUE', 'VALUEUOM', 'CHARTTIME'],
 'PRESCRIPTIONS': ['STARTDATE', 'ENDDATE', 'DRUG_NAME', 'DRUG_NAME_EN',
  'PROD_STRENGTH', 'DRUG_NAME_GENERIC', 'DOSE_VAL_RX', 'DOSE_UNIT_RX', 'DRUG_FORM'],
 'D_ITEMS': ['LABEL_CN', 'LABEL', 'LINKSTO', 'CATEGORY', 'UNITNAME'],
 'D_LABITEMS': ['LABEL_CN', 'LABEL', 'FLUID', 'CATEGORY', 'LOINC_CODE'],
 'D_ICD_DIAGNOSES': ['ICD10_CODE_CN', 'ICD10_CODE', 'TITLE_CN', 'TITLE']}
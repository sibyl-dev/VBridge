"""Schema of a subset of tables in mimic-iii-demo used for the show-case"""

relationships = [
    # PATIENTS
    ('PATIENTS', 'SUBJECT_ID', 'ADMISSIONS', 'SUBJECT_ID'),
    # ADMISSIONS
    ('ADMISSIONS', 'HADM_ID', 'ICUSTAYS', 'HADM_ID'),
    ('ADMISSIONS', 'HADM_ID', 'LABEVENTS', 'HADM_ID'),
    ('ADMISSIONS', 'HADM_ID', 'CHARTEVENTS', 'HADM_ID'),
    # DICTS
    ('D_ITEMS', 'ITEMID', 'CHARTEVENTS', 'ITEMID'),
    ('D_LABITEMS', 'ITEMID', 'LABEVENTS', 'ITEMID'),
]

entity_configs = {
    'PATIENTS': {
        'index': 'SUBJECT_ID',
    },
    'ADMISSIONS': {
        'index': 'HADM_ID',
        'identifiers': ['SUBJECT_ID'],
        'time_index': 'ADMITTIME',
        'secondary_index': {
            'DISCHTIME': ['DISCHARGE_LOCATION', 'HOSPITAL_EXPIRE_FLAG', 'DIAGNOSIS'],
            'DEATHTIME': ['DISCHARGE_LOCATION', 'HOSPITAL_EXPIRE_FLAG', 'DIAGNOSIS'],
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
    'LABEVENTS': {
        'identifiers': ['SUBJECT_ID', 'HADM_ID', 'ITEMID'],
        'time_index': 'CHARTTIME',
        'item_index': 'ITEMID',
        'interesting_values': 30,
        'value_indexes': ['VALUENUM'],
        'alias': 'Lab Tests',
    },
    'CHARTEVENTS': {
        'identifiers': ['SUBJECT_ID', 'HADM_ID', 'ITEMID'],
        'time_index': 'CHARTTIME',
        'item_index': 'ITEMID',
        'interesting_values': 30,
        'value_indexes': ['VALUENUM'],
        'alias': 'Chart Events',
    },
    'D_ITEMS': {
        'index': 'ITEMID',
    },
    'D_LABITEMS': {
        'index': 'ITEMID',
    },
}

ignore_variables = {
    'PATIENTS': ['ROW_ID', 'EXPIRE_FLAG', 'DOD', 'DOD_HOSP', 'DOD_SSN', 'SUBJECT_ID'],
    'ADMISSIONS': ['ROW_ID', 'HADM_ID', 'SUBJECT_ID', 'LANGUAGE'],
    'ICUSTAYS': ['ROW_ID', 'HADM_ID', 'ICUSTAY_ID', 'SUBJECT_ID'],
    'LABEVENTS': ['ROW_ID', 'HADM_ID', 'SUBJECT_ID', 'VALUEUOM', 'VALUE', 'CHARTTIME', 'FLAG'],
    'CHARTEVENTS': ['ROW_ID', 'SUBJECT_ID', 'HADM_ID', 'ICUSTAY_ID', 'VALUE', 'VALUEUOM',
                    'STORETIME', 'WARNING', 'ERROR', 'CGID'],
}

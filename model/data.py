import os

import pandas as pd
import featuretools as ft

from model.settings import interesting_variables, RELATIONSHIPS, META_INFO
from model.utils import remove_nan_entries, save_entityset


ROOT = os.path.dirname(os.path.dirname(__file__))
PIC_dir = os.path.join(ROOT, 'data/raw/PIC_mini/')
output_dir = os.path.join(ROOT, 'data/intermediate/')


def load_pic(save=True, verbose=True):
    es = ft.EntitySet(id="pic")

    for table_name, info in META_INFO.items():

        table_df = pd.read_csv(os.path.join(PIC_dir, '{}.csv'.format(table_name)),
                               date_parser=pd.to_datetime)

        # Create unique surgery id
        if table_name in ['SURGERY_INFO', 'SURGERY_VITAL_SIGNS']:
            table_df['UNI_OPER_ID'] = (table_df['HADM_ID'] - 100000) * 64 + table_df[
                'VISIT_ID'] * 8 + table_df['OPER_ID']

        if table_name == 'SURGERY_INFO':
            table_df = table_df[~table_df['UNI_OPER_ID'].duplicated()]
            add_info = pd.read_csv(os.path.join(PIC_dir, 'surgery_additional_features.csv'))
            table_df = pd.merge(table_df, add_info)

        index = info.get('index', 'ROW_ID')
        index_columns = info.get('foreign_index', []) + [index]
        table_df = remove_nan_entries(table_df, index_columns, verbose=verbose)

        for col, t in info.get('types', {}).items():
            table_df[col] = table_df[col].astype(t)

        es.entity_from_dataframe(entity_id=table_name,
                                 dataframe=table_df,
                                 index=index,
                                 time_index=info.get('time_index', None),
                                 secondary_time_index=info.get('secondary_index', None))

    for parent, primary_key, child, foreign_key in RELATIONSHIPS:
        new_relationship = ft.Relationship(es[parent][primary_key], es[child][foreign_key])

        es = es.add_relationship(new_relationship)

    if save:
        save_entityset(es)

    return es


def get_patient_records(es, table_name, subject_id, hadm_id=None, cutoff_times=None):
    target_table = es[table_name].df

    # select records by SUBJECT_ID
    if 'SUBJECT_ID' in target_table.columns:
        patient_df = target_table[target_table['SUBJECT_ID'] == subject_id]
    else:
        patient_df = target_table

    # select records by HADM_ID
    if hadm_id is not None and 'HADM_ID' in target_table.columns:
        patient_df = patient_df[patient_df['HADM_ID'] == hadm_id]

    # remove identifier columns
    useful_cols = interesting_variables[table_name]
    patient_df = patient_df.loc[:, useful_cols]

    # select records before or at the cutoff_time
    time_index = META_INFO[table_name].get('time_index')
    if time_index is not None and cutoff_times is not None:
        patient_df[time_index] = pd.to_datetime(patient_df[time_index])
        cutoff_times['time'] = pd.to_datetime(cutoff_times['time'])
        cutoff_time = cutoff_times[cutoff_times['SUBJECT_ID'] == subject_id]['time'].values[0]

        patient_df = patient_df[patient_df[time_index] <= cutoff_time]

    # TODO modify records according to secondary time index

    return patient_df

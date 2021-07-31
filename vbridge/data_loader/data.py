import os
from copy import deepcopy

import featuretools as ft
import pandas as pd

from vbridge.data_loader.pic_schema import META_INFO, RELATIONSHIPS
from vbridge.data_loader.utils import load_entityset, exist_entityset, \
    remove_nan_entries, save_entityset

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
PIC_dir = os.path.join(ROOT, 'data/raw/PIC_mini/')


def create_entityset(name, load_exist=True, save=True, verbose=True):
    if load_exist and exist_entityset(name):
        es = load_entityset(name)
    else:
        es = ft.EntitySet(id=name)
        # Add the entities to the entityset
        for table_name, info in META_INFO.items():
            table_df = pd.read_csv(os.path.join(PIC_dir, '{}.csv'.format(table_name)),
                                date_parser=pd.to_datetime)
            # Remove entries with missing identifiers
            index = info.get('index', 'ROW_ID')
            index_columns = info.get('identifiers', []) + [index]
            table_df = remove_nan_entries(table_df, index_columns, verbose=verbose)

            for col in index_columns:
                table_df[col] = table_df[col].astype('str')

            es.entity_from_dataframe(entity_id=table_name,
                                    dataframe=table_df,
                                    index=index,
                                    time_index=info.get('time_index', None),
                                    secondary_time_index=info.get('secondary_index', None))

        # Add the relationships to the entityset
        for parent, primary_key, child, foreign_key in RELATIONSHIPS:
            new_relationship = ft.Relationship(es[parent][primary_key], es[child][foreign_key])
            es = es.add_relationship(new_relationship)

        if save:
            save_entityset(es, name=name)

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

    # select records before or at the cutoff_time
    time_index = META_INFO[table_name].get('time_index')
    if time_index is not None and cutoff_times is not None:
        patient_df[time_index] = pd.to_datetime(patient_df[time_index])
        cutoff_times['time'] = pd.to_datetime(cutoff_times['time'])
        cutoff_time = cutoff_times[cutoff_times['SUBJECT_ID'] == subject_id]['time'].values[0]

        patient_df = patient_df[patient_df[time_index] <= cutoff_time]

    # TODO modify records according to secondary time index

    return patient_df


def filter_entries(es, period='in-surgery'):
    # TODO: warning: this function will modify the input es
    es.add_last_time_indexes()
    surgery_df = es['SURGERY_INFO'].df.set_index('SUBJECT_ID')
    surgery_begin_time = surgery_df['SURGERY_BEGIN_TIME']
    surgery_end_time = surgery_df['SURGERY_END_TIME']
    for entity in es.entities:
        df = entity.df
        time_index = entity.time_index
        if time_index and 'SUBJECT_ID' in df:
            if period == 'in-surgery':
                df = df[entity.last_time_index >= surgery_begin_time.loc[df['SUBJECT_ID']].values]
                df = df[df[time_index] <= surgery_end_time.loc[df['SUBJECT_ID']].values]
            elif period == 'pre-surgery':
                df = df[df[time_index] <= surgery_begin_time.loc[df['SUBJECT_ID']].values]
        entity.df = df
    return es


def select_entries(es):
    # TODO: warning: this function will modify the input es
    surgery_df = es['SURGERY_INFO'].df
    surgery_df = surgery_df[surgery_df['SUBJECT_ID'].isin(es['PATIENTS'].df['SUBJECT_ID'])]
    surgery_df = surgery_df[surgery_df['HADM_ID'].isin(es['ADMISSIONS'].df['HADM_ID'])]

    for entity in es.entities:
        df = entity.df
        if 'SUBJECT_ID' in df:
            df = df[df['SUBJECT_ID'].isin(surgery_df['SUBJECT_ID'])]
        if 'HADM_ID' in df:
            df = df[df['HADM_ID'].isin(surgery_df['HADM_ID'])]
        entity.df = df

    es['SURGERY_INFO'].df = surgery_df
    return es

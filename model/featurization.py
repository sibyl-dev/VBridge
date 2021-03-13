import os
from datetime import timedelta
from functools import reduce

import numpy as np
import pandas as pd
import pickle
import featuretools as ft
from featuretools.selection import remove_low_information_features, \
    remove_highly_correlated_features, remove_highly_null_features

from model.settings import ignore_variables
from model.utils import save_fm, load_fm, exist_fm


def generate_cutoff_times(es):
    target_entity = 'SURGERY_INFO'
    cutoff_times = es[target_entity].df[['UNI_OPER_ID', 'SURGERY_END_TIME']]
    cutoff_times.columns = ['instance_id', 'time']
    df = es[target_entity].df.set_index('UNI_OPER_ID')
    cutoff_times['SUBJECT_ID'] = df.loc[cutoff_times['instance_id']]['SUBJECT_ID']
    cutoff_times['HADM_ID'] = df.loc[cutoff_times['instance_id']]['HADM_ID']
    return cutoff_times


def select_features(fm, fl=None):
    fm = remove_highly_null_features(fm)
    fm = remove_low_information_features(fm)
    fm = remove_highly_correlated_features(fm)
    if fl is None:
        return fm
    else:
        fl = [f for f in fl if f.get_name() in fm.columns]
        return fm, fl


def merge_features(fm_list, fl_list, on=None):
    fm = reduce(lambda x, y: pd.merge(x, y, on=on), fm_list)
    fl = []
    fl_names = []
    for fl_item in fl_list:
        for f in fl_item:
            if f.get_name() not in fl_names:
                fl.append(f)
                fl_names.append(f.get_name())
    return fm, fl


ignore_features = ['MEAN(SURGERY_VITAL_SIGNS.VALUE)',
                   'STD(SURGERY_VITAL_SIGNS.VALUE)',
                   'TREND(SURGERY_VITAL_SIGNS.VALUE, MONITOR_TIME)',
                   'ADMISSIONS.MEAN(CHARTEVENTS.VALUE)',
                   'ADMISSIONS.STD(CHARTEVENTS.VALUE)',
                   'ADMISSIONS.TREND(CHARTEVENTS.VALUE, CHARTTIME)'
                   ]

class Exists(ft.primitives.AggregationPrimitive):
    name='exists'
    input_types = [ft.variable_types.Numeric]
    output_type = ft.variable_types.Boolean
    
    def __init__(self):
        pass
    
    def get_function(self):
        def exists(column):
            if column is None:
                return 0
            return len(column) > 0
        return exists


class Featurization:

    def __init__(self, es):
        self.es = es
        self.target_entity = 'SURGERY_INFO'
        self.label_times = es['SURGERY_INFO'].df[['UNI_OPER_ID', 'SURGERY_END_TIME']]
        self.label_times.columns = ['instance_id', 'time']
        self.es.add_last_time_indexes()

    def generate_features(self, entity_list=None, select=True, save=True, use_saved=True):
        features = []
        if entity_list is None or 'PATIENTS' in entity_list:
            features.append(self._forward_features(select, save, use_saved))
        if entity_list is None or 'SURGERY_VITAL_SIGNS' in entity_list:
            features.append(self._surgery_vital_sign_features(select, save, use_saved))
        if entity_list is None or 'CHARTEVENTS' in entity_list:
            features.append(self._chart_event_features(select, save, use_saved))
        if entity_list is None or 'LABEVENTS' in entity_list:
            features.append(self._lab_test_features(select, save, use_saved))
        if entity_list is None or 'PRESCRIPTIONS' in entity_list:
            features.append(self._prescription_features(select, save, use_saved))
        fm, fl = merge_features([f[0] for f in features], [f[1] for f in features])

        for col in ignore_features:
            if col in fm:
                fm.pop(col)
        fl = [f for f in fl if f.get_name() in fm.columns]

        # TODO: this code only works for this case. The formal id should be the surgery id
        fm = fm.set_index(self.es['SURGERY_INFO'].df['SUBJECT_ID'])
        if save:
            save_fm(fm, fl)
        return fm, fl

    def _surgery_vital_sign_features(self, select=True, save=True, use_saved=True):
        token = 'surgery_vital_sign_select={}'.format(select)
        if use_saved and exist_fm(token):
            fm, fl = load_fm(token)
        else:
            # Generate features
            vital_sign_items = self.es['SURGERY_VITAL_SIGNS'].df['ITEMID'].unique()
            self.es['SURGERY_VITAL_SIGNS']['ITEMID'].interesting_values = vital_sign_items
            fm, fl = ft.dfs(entityset=self.es,
                            target_entity=self.target_entity,
                            agg_primitives=["mean", "std", "trend"],
                            where_primitives=["mean", "std", "trend"],
                            trans_primitives=[],
                            allowed_paths=[['SURGERY_INFO', 'SURGERY_VITAL_SIGNS']],
                            ignore_variables=ignore_variables,
                            cutoff_time=self.label_times,
                            verbose=True)
            if select:
                fm, fl = select_features(fm, fl)
        if save:
            save_fm(fm, fl, token)
        return fm, fl

    def _forward_features(self, select=True, save=True, use_saved=True):
        token = 'forward_select={}'.format(select)
        if use_saved and exist_fm(token):
            fm, fl = load_fm(token)
        else:
            # Generate features
            fm, fl = ft.dfs(entityset=self.es,
                            target_entity=self.target_entity,
                            agg_primitives=[],
                            trans_primitives=[],
                            allowed_paths=[['SURGERY_INFO', 'ADMISSIONS'],
                                           ['SURGERY_INFO', 'ADMISSIONS', 'PATIENTS']],
                            ignore_variables=ignore_variables,
                            cutoff_time=self.label_times,
                            verbose=True)
            if select:
                fm, fl = select_features(fm, fl)
        if save:
            save_fm(fm, fl, token)
        return fm, fl

    def _chart_event_features(self, select=True, save=True, use_saved=True):
        token = 'chart_event_select={}'.format(select)
        if use_saved and exist_fm(token):
            fm, fl = load_fm(token)
        else:
            # Generate features
            vital_sign_items = self.es['CHARTEVENTS'].df['ITEMID'].unique()
            self.es['CHARTEVENTS']['ITEMID'].interesting_values = vital_sign_items
            fm, fl = ft.dfs(entityset=self.es,
                            target_entity=self.target_entity,
                            agg_primitives=["mean", "std", "trend"],
                            where_primitives=["mean", "std", "trend"],
                            trans_primitives=[],
                            allowed_paths=[['SURGERY_INFO', 'ADMISSIONS'],
                                           ['SURGERY_INFO', 'ADMISSIONS', 'CHARTEVENTS']],
                            ignore_variables=ignore_variables,
                            cutoff_time=self.label_times,
                            training_window='24h',
                            verbose=True)
            if select:
                fm, fl = select_features(fm, fl)
        if save:
            save_fm(fm, fl, token)
        return fm, fl

    def _lab_test_features(self, select=True, save=True, use_saved=True, item_num=100):
        token = 'in_surgery_lab_event_select={}_item_num={}'.format(select, item_num)
        if use_saved and exist_fm(token):
            fm, fl = load_fm(token)
        else:
            # Generate features
            # select frequent lab test items
            lab_count = self.es['LABEVENTS'].df['ITEMID'].value_counts()
            lab_test_items = lab_count[:item_num].index
            self.es['LABEVENTS']['ITEMID'].interesting_values = lab_test_items
            fm, fl = ft.dfs(entityset=self.es,
                            target_entity=self.target_entity,
                            agg_primitives=["mean"],
                            where_primitives=["mean"],
                            trans_primitives=[],
                            allowed_paths=[['SURGERY_INFO', 'ADMISSIONS'],
                                           ['SURGERY_INFO', 'ADMISSIONS', 'LABEVENTS']],
                            ignore_variables=ignore_variables,
                            cutoff_time=self.label_times,
                            training_window='8h',
                            verbose=True)
            if select:
                fm, fl = select_features(fm, fl)
        if save:
            save_fm(fm, fl, token)
        return fm, fl

    def _prescription_features(self, select=True, save=True, use_saved=True):
        token = 'prescriptions_select={}'.format(select)
        if use_saved and exist_fm(token):
            fm, fl = load_fm(token)
        else:
            # Generate features
            self.es["PRESCRIPTIONS"]["DRUG_NAME_EN"].interesting_values = [
                '(4:1)Glucose and Sodium Chloride Injection',
                'Sterile Water Injection', 'Enema Glycerini',
                '10% Potassium Chloride Injection', 'Cefradine for Injection',
                '5% Sodium Bicarbonate Injection',
                '20% Albumin Prepared From Human Plasma Injection',
                '25% Magnesium Sulfate Injection',
                '10% Calcium Gluconate Injection',
                'Methylprednisolone Sodium Succinate for Injection',
                '20% Mannitol Injection',
                'Creatine phosphate sodium for injection',
                '0.9% Sodium Chloride Injection',
                'Chloral hydrate powder for enema', 'Spironolactone Tablets',
                'Hydrochlorothiazide Tablets', 'Vitamin C Injection',
                'Ipratropium Bromide Solution for Inhalation',
                '10% Chloral Hydrate Enemas',
                'Phentolamine Mesylate for Injection']
            
            fm, fl = ft.dfs(entityset=self.es,
                            target_entity=self.target_entity,
                            agg_primitives=[Exists],
                            where_primitives=[Exists],
                            trans_primitives=[],
                            allowed_paths=[['SURGERY_INFO', 'ADMISSIONS'],  
                                            ['SURGERY_INFO', 'ADMISSIONS', 'PRESCRIPTIONS']],
                            ignore_variables=ignore_variables,
                            cutoff_time=self.label_times,
                            max_depth=2,
                            verbose=True)
            
            #TODO: 
            for col in fm.columns:
                if col[:len('ADMISSIONS.EXISTS')] == 'ADMISSIONS.EXISTS':
                    fm[col] = fm[col].fillna(0)
            if select:
                fm, fl = select_features(fm, fl)
        if save:
            save_fm(fm, fl, token)
        return fm, fl
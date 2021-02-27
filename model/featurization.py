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
from model.utils import save_fm


def generate_cutoff_times(es):
    target_entity = 'SURGERY_INFO'
    cutoff_times = es['SURGERY_INFO'].df[['UNI_OPER_ID', 'SURGERY_END_TIME']]
    cutoff_times.columns = ['instance_id', 'time']
    df = es['SURGERY_INFO'].df.set_index('UNI_OPER_ID')
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


def merge_features(fm_list, fl_list):
    fm = reduce(lambda x, y: pd.merge(x, y), fm_list)
    fl = []
    fl_names = []
    for fl_item in fl_list:
        for f in fl_item:
            if f.get_name() not in fl_names:
                fl.append(f)
                fl_names.append(f.get_name())
    return fm, fl


class Featurization:

    def __init__(self, es):
        self.es = es
        self.target_entity = 'SURGERY_INFO'
        self.label_times = es['SURGERY_INFO'].df[[
            'UNI_OPER_ID', 'SURGERY_END_TIME']]
        self.label_times.columns = ['instance_id', 'time']

    def generate_features(self, forward=True, surgery_vital=True, select=True, save=True):
        features = []
        if forward:
            features.append(self._forward_features(select))
        if surgery_vital:
            features.append(self._surgery_vital_sign_features(select))
        fm, fl = merge_features([f[0] for f in features], [f[1] for f in features])
        if save:
            save_fm(fm, fl)
        return fm, fl

    def _surgery_vital_sign_features(self, select=True):
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
        return fm, fl

    def _forward_features(self, select=True):
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
        return fm, fl


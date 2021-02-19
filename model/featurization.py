import os
from datetime import timedelta

import numpy as np
import pandas as pd
import pickle
import featuretools as ft
from featuretools.selection import remove_low_information_features, \
    remove_highly_correlated_features, remove_highly_null_features


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
#     fm = remove_highly_correlated_features(fm)
    if fl is None:
        return fm
    else:
        fl = [f for f in fl if f._name in fm.columns]
        return fm, fl


class Featurization:
    def __init__(self):
        pass

    def surgery_vital_sign_features(self):
        pass
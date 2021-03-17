from functools import reduce

import numpy as np
import pandas as pd
import featuretools as ft
from featuretools.selection import remove_low_information_features, \
    remove_highly_correlated_features, remove_highly_null_features

from model.data import load_in_surgery_es, load_pre_surgery_es
from model.settings import ignore_variables
from model.utils import save_fm, load_fm, exist_fm


def generate_cutoff_times(es, cutoffs='in-surgery'):
    target_entity = 'SURGERY_INFO'
    if cutoffs == 'in-surgery':
        cutoff_times = es[target_entity].df[['UNI_OPER_ID', 'SURGERY_END_TIME']]
    elif cutoffs == 'pre-surgery':
        cutoff_times = es[target_entity].df[['UNI_OPER_ID', 'SURGERY_BEGIN_TIME']]
    else:
        raise ValueError("Unsupported cutoffs.")
    cutoff_times.columns = ['instance_id', 'time']
    df = es[target_entity].df.set_index('UNI_OPER_ID')
    cutoff_times['SUBJECT_ID'] = df.loc[cutoff_times['instance_id']]['SUBJECT_ID']
    cutoff_times['HADM_ID'] = df.loc[cutoff_times['instance_id']]['HADM_ID']
    return cutoff_times


# prescription items with frequency > 5%
interesting_prescription_items = [
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
    'Phentolamine Mesylate for Injection'
]

ignore_features = [
    'MEAN(SURGERY_VITAL_SIGNS.VALUE)',
    'STD(SURGERY_VITAL_SIGNS.VALUE)',
    'TREND(SURGERY_VITAL_SIGNS.VALUE, MONITOR_TIME)',
    'ADMISSIONS.MEAN(CHARTEVENTS.VALUE)',
    'ADMISSIONS.STD(CHARTEVENTS.VALUE)',
    'ADMISSIONS.TREND(CHARTEVENTS.VALUE, CHARTTIME)',
    'ADMISSIONS.MEAN(LABEVENTS.VALUENUM)',
    'ADMISSIONS.EXISTS(PRESCRIPTIONS.DOSE_VAL_RX)'
]


class Exists(ft.primitives.AggregationPrimitive):
    name = 'exists'
    input_types = [ft.variable_types.Numeric]
    output_type = ft.variable_types.Boolean

    def __init__(self):
        super().__init__()

    def get_function(self):
        def exists(column):
            if column is None:
                return False
            return len(column) > 0

        return exists


class Featurization:

    def __init__(self, es):
        self.pre_es = load_pre_surgery_es(es)
        self.in_es = load_in_surgery_es(es)
        self.target_entity = 'SURGERY_INFO'
        self.surgery_begin_times = \
            self.in_es['SURGERY_INFO'].df[['UNI_OPER_ID', 'SURGERY_BEGIN_TIME']]
        self.surgery_end_times = \
            self.in_es['SURGERY_INFO'].df[['UNI_OPER_ID', 'SURGERY_END_TIME']]
        self.pre_es.add_last_time_indexes()
        self._add_interesting_values()

    @staticmethod
    def select_features(fm, fl=None):
        fm = remove_highly_null_features(fm)
        fm = remove_low_information_features(fm)
        fm = remove_highly_correlated_features(fm)
        if fl is None:
            return fm
        else:
            fl = [f for f in fl if f.get_name() in fm.columns]
            return fm, fl

    @staticmethod
    def remove_uninterpretable_features(fm, fl):
        where_prefix = set([f.split(' WHERE ')[0] for f in fm.columns if ' WHERE ' in f])
        uninterpretable_cols = []
        for column in fm.columns:
            if np.array([prefix in column for prefix in where_prefix]).any() \
                    and ' WHERE ' not in column:
                uninterpretable_cols.append(column)
        print("Remove: ", uninterpretable_cols)
        for column in uninterpretable_cols:
            fm.pop(column)
        fl = [f for f in fl if f.get_name() in fm.columns]
        return fm, fl

    @staticmethod
    def merge_features(fm_list, fl_list):
        index = fm_list[0].index
        feature_matrix = pd.DataFrame(fm_list[0])
        feature_list = [f for f in fl_list[0]]
        for fm, fl in zip(fm_list, fl_list):
            for f in fl:
                col = f.get_name()
                if col in feature_matrix.columns:
                    continue
                feature_matrix[col] = fm[col]
                feature_list.append(f)
        return feature_matrix.loc[index], feature_list

    @staticmethod
    def add_prefix(fm, fl, prefix, ignore_entities=None):
        if ignore_entities is None:
            ignore_entities = ['SURGERY_INFO', 'ADMISSIONS', 'PATIENTS']

        def get_end_entity_id(feature):
            if len(feature.base_features) > 0:
                return get_end_entity_id(feature.base_features[0])
            else:
                return feature.entity_id

        for f in fl:
            if get_end_entity_id(f) not in ignore_entities:
                f._name = '#'.join([prefix, f.get_name()])
        f_names = [f._name for f in fl]
        prefix_list = [col for col in fm.columns if col not in f_names]
        for col in prefix_list:
            fm['#'.join([prefix, col])] = fm.pop(col)
        return fm, fl

    def _add_interesting_values(self):
        vital_sign_items = self.in_es['SURGERY_VITAL_SIGNS'].df['ITEMID'].unique()
        self.in_es['SURGERY_VITAL_SIGNS']['ITEMID'].interesting_values = vital_sign_items

        chart_event_items = self.pre_es['CHARTEVENTS'].df['ITEMID'].unique()
        self.pre_es['CHARTEVENTS']['ITEMID'].interesting_values = chart_event_items

        lab_count = self.pre_es['LABEVENTS'].df['ITEMID'].value_counts()
        self.pre_es['LABEVENTS']['ITEMID'].interesting_values = lab_count[:45].index
        lab_count = self.in_es['LABEVENTS'].df['ITEMID'].value_counts()
        self.in_es['LABEVENTS']['ITEMID'].interesting_values = lab_count[:23].index

        med_counts = self.pre_es['PRESCRIPTIONS'].df['DRUG_NAME_EN'].value_counts()
        self.pre_es["PRESCRIPTIONS"]["DRUG_NAME_EN"].interesting_values = med_counts[:20].index

    def generate_features(self, entity_list=None, select=True, save=True, use_saved=True,
                          verbose=True):
        fp = []
        if entity_list is None:
            entity_list = ['PATIENTS', 'CHARTEVENTS', 'PRESCRIPTIONS',
                           'SURGERY_VITAL_SIGNS', 'LABEVENTS']
        if 'PATIENTS' in entity_list:
            fp.append(self._patients(cutoff_times='pre-surgery', token="PATIENTS",
                                     save=save, use_saved=use_saved, verbose=verbose))
        if 'CHARTEVENTS' in entity_list:
            fp.append(self._chart_events(cutoff_times='pre-surgery', token="CHARTEVENTS",
                                         save=save, use_saved=use_saved, verbose=verbose))
        if 'PRESCRIPTIONS' in entity_list:
            fp.append(self._prescriptions(cutoff_times='pre-surgery', token="PRESCRIPTIONS",
                                          save=save, use_saved=use_saved, verbose=verbose))
        if 'SURGERY_VITAL_SIGNS' in entity_list:
            fp.append(self._vital_signs(cutoff_times='in-surgery', token="SURGERY_VITAL_SIGNS",
                                        save=save, use_saved=use_saved, verbose=verbose))
        if 'LABEVENTS' in entity_list:
            fp.append(self._lab_tests(cutoff_times='in-surgery', token="in-surgery LABEVENTS",
                                      save=save, use_saved=use_saved, verbose=verbose))
            fp.append(self._lab_tests(cutoff_times='pre-surgery', window_size='48h',
                                      token="pre-surgery LABEVENTS",
                                      save=save, use_saved=use_saved, verbose=verbose))
        fm, fl = Featurization.merge_features([f[0] for f in fp], [f[1] for f in fp])
        fm, fl = Featurization.remove_uninterpretable_features(fm, fl)
        if select:
            fm, fl = Featurization.select_features(fm, fl)

        # TODO: this code only works for this case. The formal id should be the surgery id
        fm = fm.set_index(self.pre_es['SURGERY_INFO'].df['SUBJECT_ID'])

        if save:
            save_fm(fm, fl)
        return fm, fl

    def _generate_features(self, agg_primitives=None, trans_primitives=None, ignore_entities=None,
                           allowed_paths=None, cutoff_times='in-surgery', window_size=None,
                           add_prefix=True, save=True, use_saved=True, token=None, verbose=True):
        if agg_primitives is None:
            agg_primitives = []
        if trans_primitives is None:
            trans_primitives = []

        if cutoff_times == 'in-surgery':
            es = self.in_es
            label_times = self.surgery_end_times
        elif cutoff_times == 'pre-surgery':
            es = self.pre_es
            label_times = self.surgery_begin_times
        else:
            raise ValueError('Unsupported periods')
        label_times.columns = ['instance_id', 'time']

        if use_saved and exist_fm(token):
            fm, fl = load_fm(token)
        else:
            fm, fl = ft.dfs(entityset=es,
                            target_entity=self.target_entity,
                            agg_primitives=agg_primitives,
                            where_primitives=agg_primitives,
                            trans_primitives=trans_primitives,
                            allowed_paths=allowed_paths,
                            ignore_entities=ignore_entities,
                            ignore_variables=ignore_variables,
                            cutoff_time=label_times,
                            training_window=window_size,
                            verbose=verbose)
            if add_prefix:
                fm, fl = Featurization.add_prefix(fm, fl, cutoff_times)

        if save:
            save_fm(fm, fl, token)
        return fm, fl

    def _patients(self, cutoff_times, token=None, save=True, use_saved=True, verbose=True):
        return self._generate_features(
            allowed_paths=[['SURGERY_INFO', 'ADMISSIONS'],
                           ['SURGERY_INFO', 'ADMISSIONS', 'PATIENTS']],
            cutoff_times=cutoff_times,
            token=token,
            save=save,
            use_saved=use_saved,
            verbose=verbose
        )

    def _vital_signs(self, cutoff_times, token=None, save=True, use_saved=True,
                     verbose=True):
        return self._generate_features(
            allowed_paths=[['SURGERY_INFO', 'SURGERY_VITAL_SIGNS']],
            agg_primitives=["mean", "std", "trend"],
            cutoff_times=cutoff_times,
            token=token,
            save=save,
            use_saved=use_saved,
            verbose=verbose
        )

    def _chart_events(self, cutoff_times, token=None, window_size='48h',
                      save=True, use_saved=True, verbose=True):
        return self._generate_features(
            allowed_paths=[['SURGERY_INFO', 'ADMISSIONS'],
                           ['SURGERY_INFO', 'ADMISSIONS', 'CHARTEVENTS']],
            agg_primitives=["mean", "std", "trend"],
            cutoff_times=cutoff_times,
            window_size=window_size,
            token=token,
            save=save,
            use_saved=use_saved,
            verbose=verbose
        )

    def _lab_tests(self, cutoff_times, token=None, window_size=None,
                   save=True, use_saved=True, verbose=True):
        return self._generate_features(
            allowed_paths=[['SURGERY_INFO', 'ADMISSIONS'],
                           ['SURGERY_INFO', 'ADMISSIONS', 'LABEVENTS']],
            agg_primitives=["mean"],
            cutoff_times=cutoff_times,
            window_size=window_size,
            token=token,
            save=save,
            use_saved=use_saved,
            verbose=verbose
        )

    def _prescriptions(self, cutoff_times, token=None, window_size='48h',
                       save=True, use_saved=True, verbose=True):
        fm, fl = self._generate_features(
            allowed_paths=[['SURGERY_INFO', 'ADMISSIONS'],
                           ['SURGERY_INFO', 'ADMISSIONS', 'PRESCRIPTIONS']],
            agg_primitives=[Exists],
            cutoff_times=cutoff_times,
            window_size=window_size,
            token=token,
            save=save,
            use_saved=use_saved,
            verbose=verbose
        )
        for col in fm.columns:
            if 'ADMISSIONS.EXISTS' in col:
                fm[col] = fm[col].fillna(0)
        return fm, fl

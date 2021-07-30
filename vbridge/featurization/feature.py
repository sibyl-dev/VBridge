import featuretools as ft
import numpy as np
import pandas as pd
from datetime import timedelta
from featuretools.selection import (
    remove_highly_correlated_features, remove_highly_null_features,
    remove_low_information_features, )

from vbridge.data_loader.pic_schema import ignore_variables
from vbridge.data_loader.utils import exist_fm, load_fm, save_fm


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

    def __init__(self, es, target_entity):
        self.es = es
        self.target_entity = target_entity
        self.es.add_last_time_indexes()
        self._add_interesting_values()

    @staticmethod
    def select_features(fm, fl=None):
        if fl is None:
            fm = remove_highly_null_features(fm, pct_null_threshold=0.9)
            fm = remove_low_information_features(fm)
            fm = remove_highly_correlated_features(fm)
            return fm
        else:
            fm, fl = remove_highly_null_features(fm, fl, pct_null_threshold=0.9)
            fm, fl = remove_low_information_features(fm, fl)
            fm, fl = remove_highly_correlated_features(fm, fl)
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
    def add_prefix(fm, fl, prefix):
        for f in fl:
            f._name = '#'.join([prefix, f.get_name()])
        f_names = [f._name for f in fl]
        prefix_list = [col for col in fm.columns if col not in f_names]
        for col in prefix_list:
            fm['#'.join([prefix, col])] = fm.pop(col)
        return fm, fl

    def _add_interesting_values(self):
        vital_sign_items = self.es['SURGERY_VITAL_SIGNS'].df['ITEMID'].unique()
        self.es['SURGERY_VITAL_SIGNS']['ITEMID'].interesting_values = vital_sign_items

        chart_event_items = self.es['CHARTEVENTS'].df['ITEMID'].unique()
        self.es['CHARTEVENTS']['ITEMID'].interesting_values = chart_event_items

        lab_count = self.es['LABEVENTS'].df['ITEMID'].value_counts()
        self.es['LABEVENTS']['ITEMID'].interesting_values = lab_count[:45].index

        med_counts = self.es['PRESCRIPTIONS'].df['DRUG_NAME_EN'].value_counts()
        self.es["PRESCRIPTIONS"]["DRUG_NAME_EN"].interesting_values = med_counts[:20].index

    def generate_features(self, entity_list=None, cutoff_time=None,
                          select=True, save=True, use_saved=True, verbose=True):
        fp = []
        if entity_list is None:
            entity_list = ['PATIENTS', 'CHARTEVENTS', 'SURGERY_VITAL_SIGNS', 'LABEVENTS']
        if 'PATIENTS' in entity_list:
            fp.append(self._patients(cutoff_time=cutoff_time,
                                     save=save, use_saved=use_saved, verbose=verbose))
        if 'CHARTEVENTS' in entity_list:
            fp.append(self._chart_events(cutoff_time=cutoff_time,
                                         save=save, use_saved=use_saved, verbose=verbose))
        if 'SURGERY_VITAL_SIGNS' in entity_list:
            fp.append(self._vital_signs(cutoff_time=cutoff_time,
                                        save=save, use_saved=use_saved, verbose=verbose))
        if 'LABEVENTS' in entity_list:
            fp.append(self._lab_tests(cutoff_time=cutoff_time,
                                      save=save, use_saved=use_saved, verbose=verbose))

        fm, fl = Featurization.merge_features([f[0] for f in fp], [f[1] for f in fp])
        fm, fl = Featurization.remove_uninterpretable_features(fm, fl)
        if select:
            fm, fl = Featurization.select_features(fm, fl)
        if save:
            save_fm(fm, fl)
        return fm, fl

    def _find_path(self, target_entity):
        """Find a path of the source entity to the target_entity.
        """
        cached_nodes = [target_entity]
        parent_dict = {target_entity: None}
        while len(cached_nodes):
            parent_node = cached_nodes.pop()
            if parent_node == self.target_entity:
                break
            child_nodes = [e[0] for e in self.es.get_backward_entities(parent_node)] \
                          + [e[0] for e in self.es.get_forward_entities(parent_node)]
            for child in child_nodes:
                if child not in parent_dict:
                    parent_dict[child] = parent_node
                    cached_nodes.append(child)
        node = self.target_entity
        paths = [[node]]
        while node != target_entity:
            node = parent_dict[node]
            paths.append(paths[-1] + [node])
        return paths

    def _get_cutoff_times(self, entity_id=None, time_index=None, offset=None):
        if entity_id is None:
            entity_id = self.target_entity
        if time_index is None:
            time_index = self.es[entity_id].time_index

        if entity_id == self.target_entity:
            target = self.es[self.target_entity]
            cutoff_time = target.df.loc[:, [target.index, time_index]]
        else:
            forward_path = self.es.find_forward_paths(self.target_entity, entity_id)

    def _generate_features(self, target_entity=None, cutoff_time=None,
                           add_prefix=True, save=True, use_saved=True, **kwargs):

        if cutoff_time is None:
            target = self.es[self.target_entity]
            cutoff_time = target.df.loc[:, [target.index, target.time_index]]
            cutoff_time.columns = ['instance_id', 'time']

        if use_saved and exist_fm(target_entity):
            fm, fl = load_fm(target_entity)
        else:
            fm, fl = ft.dfs(entityset=self.es,
                            target_entity=self.target_entity,
                            allowed_paths=self._find_path(target_entity),
                            ignore_variables=ignore_variables,
                            cutoff_time=cutoff_time,
                            **kwargs)
            # if add_prefix:
            #     fm, fl = Featurization.add_prefix(fm, fl, cutoff_time)
        if save:
            save_fm(fm, fl, target_entity)
        return fm, fl

    def _patients(self, **kwargs):
        return self._generate_features(
            target_entity='PATIENTS',
            trans_primitives=[],
            **kwargs
        )

    def _vital_signs(self, **kwargs):
        return self._generate_features(
            target_entity='SURGERY_VITAL_SIGNS',
            agg_primitives=["mean", "std", "trend"],
            where_primitives=["mean", "std", "trend"],
            trans_primitives=[],
            **kwargs
        )

    def _chart_events(self, **kwargs):
        return self._generate_features(
            target_entity='CHARTEVENTS',
            agg_primitives=["mean", "std", "trend"],
            where_primitives=["mean", "std", "trend"],
            trans_primitives=[],
            **kwargs
        )

    def _lab_tests(self, **kwargs):
        return self._generate_features(
            target_entity='LABEVENTS',
            agg_primitives=["mean"],
            where_primitives=["mean"],
            trans_primitives=[],
            **kwargs
        )

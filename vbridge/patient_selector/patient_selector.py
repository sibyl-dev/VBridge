import pandas as pd
import featuretools as ft


class PatientSelector:
    def __init__(self, es, selector_vars, cutoff_time):
        self._es = es
        self._selector_vars = selector_vars
        self._extents = selector_vars  # property name and extent are required
        self._filter_var_mat = self.get_filter_var_mat(cutoff_time)
        self._index = self.select(self._extents)

    @property
    def selector_vars(self):
        return self._selector_vars

    @property
    def filter_var_mat(self):
        return self._filter_var_mat

    @property
    def extents(self):
        return self._extents

    @extents.setter
    def extents(self, extents):
        self._extents = extents
        self._index = self.select(self._extents)

    @property
    def index(self):
        return self._index

    @property
    def es(self):
        return self._es

    def get_filter_var_mat(self, cutoff_time):
        mat = ft.calculate_feature_matrix([f['feature'] for f in self.selector_vars], self.es,
                                          cutoff_time=cutoff_time)
        mat.columns = [f['name'] for f in self.selector_vars]
        return mat

    def select(self, extents):
        mat = self.filter_var_mat
        # for var in extents:

        return mat.index

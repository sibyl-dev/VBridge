import featuretools as ft

from vbridge.utils.directory_helpers import exist_selector_mat, load_selector_mat, \
    save_selector_mat


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

    def get_filter_var_mat(self, cutoff_time, load_exist=True, save=True, name=''):
        if load_exist and exist_selector_mat(name):
            mat = load_selector_mat(name)
            mat.index = mat.index.astype('str')
        else:
            mat = ft.calculate_feature_matrix([f['feature'] for f in self.selector_vars], self.es,
                                              cutoff_time=cutoff_time)
            mat.columns = [f['name'] for f in self.selector_vars]
        if save:
            save_selector_mat(mat, name)
        return mat

    def select(self, extents):
        mat = self.filter_var_mat
        for var in extents:
            name = var['name']
            extent = var['extent']
            if var['type'] == 'categorical':
                mat = mat[mat[name].isin(extent)]
            elif var['type'] == 'numerical':
                mat = mat[(mat[name] >= extent[0]) & (mat[name] <= extent[1])]
            else:
                raise ValueError("Unsupported type: {}".format(var['type']))
        return mat.index

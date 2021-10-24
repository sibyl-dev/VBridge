import collections

import pandas as pd

from sklearn.base import TransformerMixin


class OneHotEncoder(TransformerMixin):
    """Encode categorical columns into one-hot/multi-hot codes."""

    def __init__(self, topk=10):
        self._dummy_dict = {}
        self._dummy_columns = None
        self.topk = topk

    def fit(self, X):
        X = pd.DataFrame(X)
        for column_name in X.columns:
            if X[column_name].dtype == object:
                values = X[column_name]
                if values.apply(lambda row: isinstance(row, list)).all():
                    counts = values.apply(collections.Counter).reset_index(drop=True)
                    sub_df = pd.DataFrame.from_records(counts, index=values.index).fillna(0)
                    selected_dummies = sub_df.sum(axis=0) \
                        .sort_values(ascending=False).index[:self.topk]
                    dummies = sub_df[selected_dummies]
                    others = sub_df[[col for col in sub_df.columns if col not in selected_dummies]]
                    dummies['Others'] = others.any(axis=1)
                else:
                    counts = pd.value_counts(values, sort=True, ascending=False)
                    selected_dummies = counts[:self.topk].index
                    mask = values.isin(selected_dummies)
                    values[~mask] = "Others"
                    dummies = pd.get_dummies(values)
                dummies = dummies.add_prefix(column_name + "_")
                X = X.join(dummies)
                self._dummy_dict[column_name] = selected_dummies
        self._dummy_columns = [col for col in X.columns if col not in self.dummy_dict]
        return self

    def transform(self, X):
        X = pd.DataFrame(X)
        for column_name, selected_dummies in self._dummy_dict.items():
            values = X[column_name]
            if values.apply(lambda row: isinstance(row, list)).all():
                counts = values.apply(collections.Counter).reset_index(drop=True)
                sub_df = pd.DataFrame.from_records(counts, index=values.index).fillna(0)
                dummies = sub_df.loc[:, sub_df.columns.isin(selected_dummies)]
                others = sub_df[[col for col in sub_df.columns if col not in selected_dummies]]
                dummies['Others'] = others.any(axis=1)
            else:
                mask = values.isin(selected_dummies)
                values[~mask] = "Others"
                dummies = pd.get_dummies(values)
            dummies = dummies.add_prefix(column_name + "_")
            X = X.join(dummies)
        return X.reindex(columns=self.dummy_columns)

    @property
    def dummy_columns(self):
        return self._dummy_columns

    @property
    def dummy_dict(self):
        return self._dummy_dict

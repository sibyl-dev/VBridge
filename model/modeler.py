import collections

import pandas as pd
import numpy as np
import sklearn
import shap
from sklearn.model_selection import train_test_split
from sklearn.utils import class_weight
from sklearn.base import TransformerMixin
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import MinMaxScaler
from xgboost import XGBClassifier

classification_metrics = {
    'Accuracy': sklearn.metrics.accuracy_score,
    'F1 Macro': lambda y_true, y_pred: sklearn.metrics.f1_score(y_true, y_pred, average="macro"),
    'Precision': lambda y_true, y_pred: sklearn.metrics.precision_score(y_true, y_pred,
                                                                        average="macro"),
    'Recall': lambda y_true, y_pred: sklearn.metrics.recall_score(y_true, y_pred, average="macro"),
    'Confusion Matrix': sklearn.metrics.confusion_matrix,
    'AUROC': lambda y_true, y_pred: sklearn.metrics.roc_auc_score(y_true, y_pred, average="macro"),
}


def test(model, X, y):
    y_pred_proba = model.predict_proba(X)
    y_pred = model.predict(X)
    scores = {}
    for name, func in classification_metrics.items():
        if name is 'AUROC':
            scores[name] = func(y, y_pred_proba[:, 1])
        else:
            scores[name] = func(y, y_pred)
    return scores


class Modeler:
    def __init__(self, topk=10, **kwargs):
        self._one_hot_encoder = OneHotEncoder(topk=topk)
        self._imputer = SimpleImputer()
        self._scaler = MinMaxScaler()
        self._model = XGBClassifier(use_label_encoder=False, **kwargs)
        # self._model = XGBClassifier(eval_metric='logloss', use_label_encoder=False)
        self._explainer = None

    @staticmethod
    def prediction_targets():
        return ['complication', 'lung complication', 'cardiac complication',
                'arrhythmia complication', 'infectious complication',
                'other complication']

    @staticmethod
    def train_test_split(fm, test_size=0.2, shuffle=True):
        y = fm.loc[:, Modeler.prediction_targets()]
        X = fm.loc[:, [col for col in fm.columns if col not in Modeler.prediction_targets()]]
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size,
                                                            shuffle=shuffle)
        return X_train, X_test, y_train, y_test

    @property
    def model(self):
        return self._model

    def fit(self, X, y, target='complication', explain=True):
        y_train = y[target].values

        X_train = self._one_hot_encoder.fit_transform(X)
        X_train = self._imputer.fit_transform(X_train)
        X_train = self._scaler.fit_transform(X_train)

        weights = class_weight.compute_class_weight('balanced', [0, 1], y_train)
        sample_weight = [weights[l] for l in y_train]
        self._model.fit(X_train, y_train, sample_weight=sample_weight, eval_metric='auc')
        # self._model.fit(X_train, y_train)
        if explain:
            self._explainer = shap.TreeExplainer(self._model)

    def transform(self, X):
        X = self._one_hot_encoder.transform(X)
        X = self._imputer.transform(X)
        X = self._scaler.transform(X)
        return self._model.predict_proba(X)

    def test(self, X, y, target='complication'):
        y_test = y[target].values
        X_test = self._one_hot_encoder.transform(X)
        X_test = self._imputer.transform(X_test)
        X_test = self._scaler.transform(X_test)
        return test(self.model, X_test, y_test)

    def SHAP(self, X):
        columns = X.columns
        X = self._one_hot_encoder.transform(X)
        X = self._imputer.transform(X)
        X = self._scaler.transform(X)
        dummy_columns = self._one_hot_encoder.dummy_columns
        shap_values = pd.DataFrame(self._explainer.shap_values(X), columns=dummy_columns)
        for original_col, dummies in self._one_hot_encoder.dummy_dict.items():
            sub_dummy_column = ["{}_{}".format(original_col, cat) for cat in dummies]
            assert np.array([col in dummy_columns for col in sub_dummy_column]).all()
            if original_col+"_Others" in dummy_columns:
                sub_dummy_column.append(original_col+"_Others")
            shap_values[original_col] = shap_values.loc[:, sub_dummy_column].sum(axis=1)
        return shap_values.reindex(columns=columns)


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
                if values.apply(lambda row: type(row) == list).all():
                    counts = values.apply(collections.Counter).reset_index(drop=True)
                    sub_df = pd.DataFrame.from_records(counts, index=values.index).fillna(0)
                    selected_dummies = sub_df.sum(axis=0)\
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
            if values.apply(lambda row: type(row) == list).all():
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

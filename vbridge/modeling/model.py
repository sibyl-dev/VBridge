import os
import pickle

import pandas as pd
import shap
import sklearn
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import MinMaxScaler
from sklearn.utils import class_weight
from xgboost import XGBClassifier

from vbridge.modeling.primitive.onehotencoder import OneHotEncoder
from vbridge.utils.directory_helpers import output_workspace

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
        if name == 'AUROC':
            scores[name] = func(y, y_pred_proba[:, 1])
        else:
            scores[name] = func(y, y_pred)
    return scores


class Model:
    def __init__(self, topk=10):
        self._one_hot_encoder = OneHotEncoder(topk=topk)
        self._imputer = SimpleImputer()
        self._scaler = MinMaxScaler()
        self._model = XGBClassifier(use_label_encoder=False)
        self._explainer = None

    @property
    def model(self):
        return self._model

    def fit(self, X, y):
        y_train = y.values

        X_train = self._one_hot_encoder.fit_transform(X)
        X_train = self._imputer.fit_transform(X_train)
        X_train = self._scaler.fit_transform(X_train)

        weights = class_weight.compute_class_weight('balanced', [0, 1], y_train)
        sample_weight = [weights[instance] for instance in y_train]
        self._model.fit(X_train, y_train, sample_weight=sample_weight)

    def transform(self, X):
        X = self._one_hot_encoder.transform(X)
        X = self._imputer.transform(X)
        X = self._scaler.transform(X)
        return self._model.predict_proba(X)

    def test(self, X, y):
        y_test = y.values
        X_test = self._one_hot_encoder.transform(X)
        X_test = self._imputer.transform(X_test)
        X_test = self._scaler.transform(X_test)
        return test(self.model, X_test, y_test)

    def SHAP(self, X):
        if self._explainer is None:
            self._explainer = shap.TreeExplainer(self._model)
        columns = X.columns
        X = self._one_hot_encoder.transform(X)
        X = self._imputer.transform(X)
        X = self._scaler.transform(X)
        dummy_columns = self._one_hot_encoder.dummy_columns

        shap_values = pd.DataFrame(self._explainer.shap_values(X), columns=dummy_columns)
        for original_col, dummies in self._one_hot_encoder.dummy_dict.items():
            sub_dummy_column = ["{}_{}".format(original_col, cat) for cat in dummies]
            assert all([col in dummy_columns for col in sub_dummy_column])
            if original_col + "_Others" in dummy_columns:
                sub_dummy_column.append(original_col + "_Others")
            shap_values[original_col] = shap_values.loc[:, sub_dummy_column].sum(axis=1)
        return shap_values.reindex(columns=columns)


class ModelManager:
    def __init__(self, fm, labels=None, task=None):
        self._models = {}
        self.dataset_id = task.dataset_id
        self.task_id = task.task_id
        self.X_train, self.X_test = train_test_split(fm, random_state=3)
        self.y_train = pd.DataFrame(index=self.X_train.index)
        self.y_test = pd.DataFrame(index=self.X_test.index)
        for name, label in labels.items():
            self.add_model(label, name=name)

    def add_model(self, label, model=None, name=None):
        if name is None:
            name = "model-{}".format(len(self._models))
        if model is None:
            model = Model()
        self._models[name] = model
        self.y_train[name] = label.loc[self.y_train.index]
        self.y_test[name] = label.loc[self.y_test.index]

    @property
    def models(self):
        return self._models

    def fit_all(self):
        for target_name, model in self._models.items():
            model.fit(self.X_train, self.y_train[target_name])

    def evaluate(self):
        scores = {target_name: model.test(self.X_test, self.y_test[target_name])
                  for target_name, model in self._models.items()}
        return pd.DataFrame(scores).T

    def predict_proba(self, X):
        scores = {}
        for target_name, model in self._models.items():
            scores[target_name] = model.transform(X)[:, 1]
        return scores

    def explain(self, id=None, X=None, target=None):
        if id is not None:
            if id in self.X_train.index:
                X = self.X_train.loc[id]
            elif id in self.X_test.index:
                X = self.X_test.loc[id]
            else:
                raise ValueError("Invalid id.")
            X = X.to_frame().T
        elif X is not None:
            X = X
        else:
            X = pd.concat([self.X_train, self.X_test])
        if target is None:
            return {target: model.SHAP(X) for target, model in self.models.items()}
        else:
            return self.models[target].SHAP(X)

    def save(self):
        path = os.path.join(output_workspace, self.dataset_id, self.task_id, 'model.pkl')
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'wb') as pickle_file:
            pickle.dump(self, pickle_file)

    @staticmethod
    def exist(task):
        path = os.path.join(output_workspace, task.dataset_id, task.task_id, 'model.pkl')
        return os.path.exists(path)

    @staticmethod
    def load(task):
        path = os.path.join(output_workspace, task.dataset_id, task.task_id, 'model.pkl')
        with open(path, 'rb') as pickle_file:
            obj = pickle.load(pickle_file)
        if not isinstance(obj, ModelManager):
            raise ValueError('Serialized object is not a Modeler instance')
        return obj

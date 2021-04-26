import os

import pandas as pd
import pickle

from vbridge.modeling.modeler import Modeler

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
output_dir = os.path.join(ROOT, 'data/intermediate/')


class ModelManager:
    def __init__(self, fm, topk=10, **kwargs):
        self._models = {target_name: Modeler(topk=topk, **kwargs)
                        for target_name in Modeler.prediction_targets()}
        self.X_train, self.X_test, self.y_train, self.y_test = Modeler.train_test_split(fm)

    @property
    def model(self):
        return self._models

    def fit_all(self):
        for target_name, model in self._models.items():
            model.fit(self.X_train, self.y_train, (self.X_test, self.y_test), target_name)

    def evaluate(self):
        scores = {target_name: model.test(self.X_test, self.y_test, target_name)
                  for target_name, model in self._models.items()}
        return pd.DataFrame(scores).T

    def predict_proba(self, id=None, X=None):
        scores = {}
        if id is not None:
            if id in self.X_train.index:
                X = self.X_train.loc[id]
            elif id in self.X_test.index:
                X = self.X_test.loc[id]
            else:
                raise ValueError("Invalid id.")
            X = X.to_frame().T
            for target_name, model in self._models.items():
                scores[target_name] = model.transform(X)[0, 1]
        elif X is not None:
            X = X
            for target_name, model in self._models.items():
                scores[target_name] = model.transform(X)[:, 1]
        else:
            raise ValueError("id and X should not be both None.")
        return scores

    def explain(self, id=None, X=None, target='complication'):
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
            raise ValueError("id and X should not be both None.")
        return self.model[target].SHAP(X)

    def save(self, path=None):
        if path is None:
            path = os.path.join(output_dir, 'model_manager.pkl')
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'wb') as pickle_file:
            pickle.dump(self, pickle_file)

    @staticmethod
    def load(path=None):
        if path is None:
            path = os.path.join(output_dir, 'model_manager.pkl')
        with open(path, 'rb') as pickle_file:
            obj = pickle.load(pickle_file)
        # if not isinstance(obj, ModelManager):
        #     raise ValueError('Serialized object is not a Modeler instance')
        return obj
# -*- coding: utf-8 -*-
from vbridge.data_loader.data import create_entityset
from vbridge.explainer.explanation import Explainer
from vbridge.featurization.feature import Featurization
from vbridge.modeling.model import ModelManager
from vbridge.patient_selector.patient_selector import PatientSelector

"""Main module."""


class VBridge:
    """An interface class that ties the prediction and explanation modules together.

    Args:
        task (Task):
            the task object describing all settings of the dataset and prediction task.
    """
    def __init__(self, task):
        self._task = task
        self._entity_set = None
        self._featurizer = None
        self._modeler = None
        self._explainer = None
        self._cohort_selector = None

        self._cutoff_times = None
        self._feature_matrix = None
        self._feature_list = None
        self._selector_variable = None

    @property
    def task(self):
        return self._task

    @property
    def entity_set(self):
        return self._entity_set

    @property
    def featurizer(self):
        return self._featurizer

    @property
    def feature_matrix(self):
        return self._feature_matrix

    @property
    def feature_list(self):
        return self._feature_list

    @property
    def modeler(self):
        return self._modeler

    @property
    def explainer(self):
        return self._explainer

    @property
    def cohort_selector(self):
        return self._cohort_selector

    @property
    def selector_variable(self):
        return self._selector_variable

    def load_entity_set(self, load_exist=True, save=True, verbose=True):
        """Load the entity set according to the specification in the task.

        Args:
            load_exist (bool):
                Whether to load the cached entity set (pickle file). By default, the path is
                `output/${dataset_id}/entityset.pkl`.
            save (bool):
                Whether to save the loaded entity set into a pickle file. By default, the path is
                `output/${dataset_id}/entityset.pkl`.
            verbose (bool):
                Whether to log the information.
        """
        self._entity_set = create_entityset(
            dataset_id=self.task.dataset_id,
            entity_configs=self.task.entity_configs,
            relationships=self.task.relationships,
            table_dir=self.task.table_dir,
            load_exist=load_exist, save=save, verbose=verbose
        )

    def generate_features(self, load_exist=True, save=True, verbose=True):
        """Generate features from the entity set according to the specification in the task.

        Args:
            load_exist (bool):
                Whether to load the cached feature matrix (.csv) and feature list (pickle file).
                By default, the path is `output/${dataset_id}/${task_id}` + `fm.csv/fl.pkl`.
            save (bool):
                Whether to save feature matrix into a csv file and save feature list into a pickle
                file. By default, the path is `output/${dataset_id}/${task_id}` + `fm.csv/fl.pkl`.
            verbose (bool):
                Whether to log the information.
        Raises:
            ValueError:
                If the entity set has not loaded
        """
        if self.entity_set is None:
            raise ValueError("The entity set has not been loaded.")

        if self._cutoff_times is None:
            self._cutoff_times = self.task.get_cutoff_times(self.entity_set)
        if self.featurizer is None:
            self._featurizer = Featurization(self.entity_set, self.task)
        self._feature_matrix, self._feature_list = self._featurizer.generate_features(
            load_exist=load_exist, save=save, verbose=verbose)
        return self._feature_matrix, self._feature_list

    def build_cohort_selector(self):
        """Build a cohort selector according to the specification in the task.

        Raises:
            ValueError:
                If the entity set has not loaded
        """
        if self.entity_set is None:
            raise ValueError("The entity set has not been loaded.")

        self._selector_variable = self.task.get_selector_vars(self.entity_set)
        self._cohort_selector = PatientSelector(self.entity_set, self.selector_variable,
                                                self._cutoff_times)

    def train_model(self, evaluate=True, load_exist=True, save=True):
        """Train machine learning models from the generated features and labels specified in the
        task.

        Args:
            evaluate (bool):
                Whether to evaluate model performance and return model evaluation results.
            load_exist (bool):
                Whether to load the cached model (pickle file).
                By default, the path is `output/${dataset_id}/${task_id}/model.pkl`.
            save (bool):
                Whether to save modeler into a pickle file.
                By default, the path is `output/${dataset_id}/${task_id}/model.pkl`.

        Raises:
            ValueError:
                If the features have not been generated
        """
        if self.feature_matrix is None:
            raise ValueError("The features have not been generated.")

        # Load the model if exist
        if load_exist and ModelManager.exist(self.task):
            self._modeler = ModelManager.load(self.task)
        else:
            labels = self.task.get_labels(self.entity_set)
            self._modeler = ModelManager(self.feature_matrix, labels, self.task)

        # Fit the model
        self._modeler.fit_all()

        if save:
            self._modeler.save()
        if evaluate:
            return self._modeler.evaluate()

    def feature_explain(self, X, target=None):
        """Generate SHAP explanations to the input features.

        Args:
            X (pd.DataFrame):
                Input feature values from multiple instances for prediction and explanation.
            target (str):
                The target prediction task to explain.

        Returns:
            shap_values (pd.DataFrame)
                SHAP values of the input features.

        Raises:
            ValueError:
                If the modeler is None.
        """
        if self.modeler is None:
            raise ValueError("The model has not been built.")

        return self.modeler.explain(X=X, target=target)

    def record_explain(self, instance_id, feature, flip=False):
        """Find influential segments of the corresponding records to the target feature's value.

        Args:
            instance_id (str):
                The identifier of the target instance (e.g., patient, or patient's admission).
            feature (str):
                The identifier of the feature (i.e., the feature name).
            flip (bool):
                Whether to flip the importance of the records (i.e., v -> -v).
        Returns:
            signal_explanation (list):
                A list of important segment specifications (dict), containing
                    startTime (str): the start time of the segment,
                    endTime (str): the end time of the segment,
                    contriSum (number): the total contribution of the segment to the feature value,
                    maxValue (number): the maximum value of the corresponding records
                        in the segment.
                    minValue (number): the minimum value of the corresponding records
                        in the segment.
        """
        if self.explainer is None:
            self._explainer = Explainer(self.entity_set, self.task, self._cutoff_times)
        # TODO - select cohort before calculate influence
        return self._explainer.occlusion_explain(feature, instance_id, flip)

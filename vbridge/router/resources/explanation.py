import logging

import pandas as pd
from flask import current_app, jsonify
from flask_restful import Resource, reqparse

from vbridge.modeling.modeler import Modeler

LOGGER = logging.getLogger(__name__)


def get_shap_values(model_manager, subject_id, target):
    shap_values = model_manager.explain(id=subject_id, target=target)
    return jsonify(shap_values.loc[0].to_dict())


def get_what_if_shap_values(fm, model_manager, subject_id, target):
    shap_values = {}
    if current_app.selected_subject_ids is not None:
        selected_fm = fm.loc[current_app.selected_subject_ids]
        selected_fm = selected_fm[selected_fm['complication'] == 0]
    else:
        selected_fm = fm
    targets = Modeler.prediction_targets()
    stat = selected_fm.agg(['mean', 'count', 'std']).T
    stat['low'] = stat['mean'] - stat['std'] * 1.96
    stat['high'] = stat['mean'] + stat['std'] * 1.96

    target_fv = fm.loc[subject_id]

    # What-if analysis on out-of-distribution high values
    high_features = target_fv[target_fv > stat['high']].index
    high_features = [f for f in high_features if f not in targets]
    if len(high_features) > 0:
        high_fm = pd.DataFrame(
            target_fv.values.repeat(
                len(high_features)).reshape(-1, len(high_features)),
            columns=high_features, index=fm.columns)
        for feature in high_features:
            high_fm.loc[feature, feature] = stat.loc[feature]['high']
        explanations = model_manager.explain(X=high_fm.T, target=target)
        predictions = model_manager.predict_proba(X=high_fm.T)[target]
        for i, feature in enumerate(high_features):
            shap_values[feature] = {'shap': explanations.loc[i, feature],
                                    'prediction': predictions[i]}

    # What-if analysis on out-of-distribution low values
    low_features = target_fv[target_fv < stat['low']].index
    low_features = [f for f in low_features if f not in targets]
    if len(low_features) > 0:
        low_fm = pd.DataFrame(
            target_fv.values.repeat(
                len(low_features)).reshape(-1, len(low_features)),
            columns=low_features, index=fm.columns)
        for feature in low_features:
            low_fm.loc[feature, feature] = stat.loc[feature]['low']
        explanations = model_manager.explain(X=low_fm.T, target=target)
        predictions = model_manager.predict_proba(X=low_fm.T)[target]
        for i, feature in enumerate(low_features):
            shap_values[feature] = {'shap': explanations.loc[i, feature],
                                    'prediction': predictions[i]}

    return jsonify(shap_values)


class ShapValues(Resource):
    def __init__(self):
        self.model_manager = current_app.model_manager

        parser_get = reqparse.RequestParser(bundle_errors=True)
        parser_get.add_argument('subject_id', type=int, required=True, location='args')
        parser_get.add_argument('target', type=str, required=True, location='args')
        self.parser_get = parser_get

    def get(self):
        """
        Get the SHAP explanations of a patient.
        ---
        tags:
          - explanation
        parameters:
          - name: subject_id
            in: query
            schema:
              type: integer
            required: true
            description: ID of the target patient.
          - name: target
            in: query
            schema:
              type: string
            required: true
            description: ID of the prediction target.
        responses:
          200:
            description: The SHAP explanations.
            content:
              application/json:
                schema:
                  type: object
          400:
            $ref: '#/components/responses/ErrorMessage'
          500:
            $ref: '#/components/responses/ErrorMessage'
        """
        try:
            args = self.parser_get.parse_args()
        except Exception as e:
            LOGGER.exception(str(e))
            return {'message', str(e)}, 400

        subject_id = args['subject_id']
        target = args['target']
        try:
            res = get_shap_values(self.model_manager, subject_id, target)
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res


class ShapValuesIfNormal(Resource):
    def __init__(self):
        self.fm = current_app.fm
        self.model_manager = current_app.model_manager

        parser_get = reqparse.RequestParser(bundle_errors=True)
        parser_get.add_argument('subject_id', type=int, required=True, location='args')
        parser_get.add_argument('target', type=str, required=True, location='args')
        self.parser_get = parser_get

    def get(self):
        """
        Modify the out-of-reference-range features to the closet normal values one by one and
        get the updated predictions and SHAP explanations.
        ---
        tags:
          - explanation
        parameters:
          - name: subject_id
            in: query
            schema:
              type: integer
            required: true
            description: ID of the target patient.
          - name: target
            in: query
            schema:
              type: string
            required: true
            description: ID of the prediction target.
        responses:
          200:
            description: The updated predictions and SHAP explanations.
            content:
              application/json:
                schema:
                  type: object
          400:
            $ref: '#/components/responses/ErrorMessage'
          500:
            $ref: '#/components/responses/ErrorMessage'
        """
        try:
            args = self.parser_get.parse_args()
        except Exception as e:
            LOGGER.exception(str(e))
            return {'message', str(e)}, 400

        subject_id = args['subject_id']
        target = args['target']
        try:
            res = get_what_if_shap_values(self.fm, self.model_manager, subject_id, target)
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res

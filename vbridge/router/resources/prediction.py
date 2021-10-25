import logging

from flask import current_app, jsonify
from flask_restful import Resource

LOGGER = logging.getLogger(__name__)


def get_prediction_values(models, fm, direct_id=None):
    if direct_id is None:
        predictions = models.predict_proba(fm)
    else:
        predictions = models.predict_proba(fm.loc[direct_id].to_frame().T)
    return predictions


class Prediction(Resource):

    def get(self, direct_id):
        """
        Get the prediction results of a target patient.
        ---
        tags:
          - prediction
        parameters:
          - name: direct_id
            in: path
            required: true
            schema:
              type: string
            description: the identifier of the patient's related entry in the target entity
                (e.g., the admission id).
        responses:
          200:
            description: The prediction results of the target patient.
            content:
              application/json:
                schema:
                  type: object
                  additionalProperties:
                    type: number
          400:
            $ref: '#/components/responses/ErrorMessage'
          500:
            $ref: '#/components/responses/ErrorMessage'
        """
        try:
            settings = current_app.settings
            res = get_prediction_values(settings["models"], settings['feature_matrix'],
                                        direct_id)
            res = jsonify(res)
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res


class AllPrediction(Resource):

    def get(self):
        """
        Get the prediction results of all patients.
        ---
        tags:
          - prediction
        responses:
          200:
            description: The prediction results of all patients.
            content:
              application/json:
                schema:
                  type: object
                  additionalProperties:
                    type: array
                    items:
                      type: number

          400:
            $ref: '#/components/responses/ErrorMessage'
          500:
            $ref: '#/components/responses/ErrorMessage'
        """
        try:
            settings = current_app.settings
            res = get_prediction_values(settings["models"], settings['feature_matrix'])
            res = jsonify(res)
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res

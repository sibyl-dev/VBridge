import logging

from flask import current_app, jsonify
from flask_restful import Resource

LOGGER = logging.getLogger(__name__)


def get_prediction_description():
    pass


def get_prediction_values(model_manager, direct_id=None):
    predictions = model_manager.predict_proba(direct_id)
    return jsonify(predictions)


class Prediction(Resource):

    def get(self, direct_id):
        """
        Get the prediction results of a target patient.
        ---
        tags:
          - model
        parameters:
          - name: direct_id
            in: path
            schema:
              type: str
            required: true
            description: ID of the target patient.
        responses:
          200:
            description: The prediction results.
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
            res = get_prediction_values(current_app.model_manager, direct_id)
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res

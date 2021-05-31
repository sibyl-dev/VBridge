import logging

from flask import current_app, jsonify
from flask_restful import Resource

from vbridge.modeling.modeler import Modeler

LOGGER = logging.getLogger(__name__)


def get_prediction(model_manager, subject_id):
    subject_id = int(subject_id)
    predictions = model_manager.predict_proba(subject_id)
    return jsonify(predictions)


class Prediction(Resource):

    def __init__(self):
        self.model_manager = current_app.model_manager

    def get(self, subject_id):
        """
        Get the prediction results of a target patient.
        ---
        tags:
          - model
        parameters:
          - name: subject_id
            in: path
            schema:
              type: integer
            required: true
            description: ID of the target patient.
        responses:
          200:
            description: The prediction results.
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
            res = get_prediction(self.model_manager, subject_id)
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res

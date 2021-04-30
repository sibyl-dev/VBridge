import logging

from flask import current_app, jsonify
from flask_restful import Resource, reqparse

from vbridge.modeling.modeler import Modeler

LOGGER = logging.getLogger(__name__)


def get_prediction_target():
    return jsonify(Modeler.prediction_targets())


def get_prediction(model_manager, subject_id):
    predictions = model_manager.predict_proba(subject_id)
    return jsonify(predictions)


class PredictionTargets(Resource):

    def get(self):
        try:
            res = get_prediction_target()
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res


class Prediction(Resource):

    def __init__(self):
        self.model_manager = current_app.model_manager
        parser_get = reqparse.RequestParser(bundle_errors=True)
        parser_get.add_argument('subject_id', type=int, required=True, location='args')
        self.parser_get = parser_get

    def get(self):
        try:
            args = self.parser_get.parse_args()
        except Exception as e:
            LOGGER.exception(str(e))
            return {'message', str(e)}, 400

        subject_id = args['subject_id']
        try:
            res = get_prediction(self.model_manager, subject_id)
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res

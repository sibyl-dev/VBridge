import logging

from flask import current_app
from flask_restful import Resource, reqparse

LOGGER = logging.getLogger(__name__)


def get_explain_signal(features, direct_id, fm, ex, selected_ids=None):
    if selected_ids is not None:
        reference_fm = fm.loc[selected_ids]
    else:
        reference_fm = fm
    important_segs = []
    for f in features:
        mean, std = reference_fm[f.get_name()].agg(['mean', 'std'])
        target_value = fm.loc[direct_id, f.get_name()]
        important_segs.append({
            'featureName': f.get_name(),
            'segments': ex.occlusion_explain(f, direct_id, flip=target_value < mean)
        })

    return important_segs


class SignalExplanation(Resource):
    def __init__(self):

        parser_get = reqparse.RequestParser()
        parser_get.add_argument('features', type=str, required=True, location='args')
        self.parser_get = parser_get

    def get(self, direct_id):
        """
        Get the important record segments contributing to related features with the given item ID.
        ---
        tags:
          - explanation
        parameters:
          - name: direct_id
            in: path
            schema:
              type: string
            required: true
            description: The identifier of the patient's related entry in the target entity
                (e.g., the admission id).
          - name: features
            in: query
            schema:
              type: string
            required: true
            description: A list of feature names concatenated with comma.
        responses:
          200:
            description: The important time segments.
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/SignalExplanation'
          400:
            $ref: '#/components/responses/ErrorMessage'
          500:
            $ref: '#/components/responses/ErrorMessage'
        """
        try:
            args = self.parser_get.parse_args()
            feature_names = args.get('features', '').split(',')
        except Exception as e:
            LOGGER.exception(str(e))
            return {'message', str(e)}, 400

        try:
            settings = current_app.settings
            fm = settings["feature_matrix"]
            fl = settings["feature_list"]
            ex = settings["explainer"]
            ids = settings.get('selected_ids', None)
            features = [next(f for f in fl if f.get_name() == f_name) for f_name in feature_names]
            res = get_explain_signal(features, direct_id, fm, ex, ids)
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res

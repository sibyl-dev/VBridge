import logging

import featuretools as ft
from flask import current_app, jsonify
from flask_restful import Resource, reqparse

LOGGER = logging.getLogger(__name__)


def get_explain_signal(fm, ex, subject_id, item_id):
    if current_app.selected_subject_ids is not None:
        reference_fm = fm.loc[current_app.selected_subject_ids]
        reference_fm = reference_fm[reference_fm['complication'] == 0]
    else:
        reference_fm = fm
    important_segs = []
    for primitive in ['mean', 'std', 'trend']:
        if primitive.lower() == 'mean':
            primitive_fn = ft.primitives.Mean()
            feature_name = "in-surgery#MEAN(SURGERY_VITAL_SIGNS.VALUE WHERE ITEMID = %s)" % (
                item_id)
        elif primitive.lower() == 'std':
            primitive_fn = ft.primitives.Std()
            feature_name = "in-surgery#STD(SURGERY_VITAL_SIGNS.VALUE WHERE ITEMID = %s)" % (
                item_id)
        elif primitive.lower() == 'trend':
            primitive_fn = ft.primitives.Trend()
            feature_name = "in-surgery#TREND(SURGERY_VITAL_SIGNS.VALUE, MONITOR_TIME WHERE " \
                           "ITEMID = %s)" % item_id
        else:
            raise ValueError("Unsupported feature name")
        mean, std = reference_fm[feature_name].agg(['mean', 'std'])
        target_value = fm.loc[subject_id, feature_name]
        important_segs.append({
            'featureName': feature_name,
            'segments': ex.occlusion_explain(item_id, "SURGERY_VITAL_SIGNS",
                                             primitive_fn, subject_id,
                                             flip=target_value < mean)})

    return jsonify(important_segs)


class SignalExplanation(Resource):
    def __init__(self):
        self.fm = current_app.fm
        self.ex = current_app.ex

        parser_get = reqparse.RequestParser(bundle_errors=True)
        parser_get.add_argument('subject_id', type=int, required=True, location='args')
        parser_get.add_argument('item_id', type=str, required=True, location='args')
        self.parser_get = parser_get

    def get(self):
        """
        Get the important record segments contributing to related features with the given item ID.
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
          - name: item_id
            in: query
            schema:
              type: string
            required: true
            description: ID of the item.
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
        except Exception as e:
            LOGGER.exception(str(e))
            return {'message', str(e)}, 400

        subject_id = args['subject_id']
        item_id = args['item_id']
        try:
            res = get_explain_signal(self.fm, self.ex, subject_id, item_id)
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res

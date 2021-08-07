import logging

from flask import Response, current_app, jsonify
from flask_restful import Resource

from vbridge.utils import get_item_dict
from vbridge.utils import get_feature_description, group_features_by_entity, \
    group_features_by_where_item

LOGGER = logging.getLogger(__name__)


def get_feature_descriptions(fl, es=None, in_hierarchy=True):

    item_dict = get_item_dict(es) if es is not None else None
    features = [get_feature_description(f, item_dict) for f in fl]
    if in_hierarchy:
        # TODO: A sample grouping schema: entity (e.g., Vital Signs) -> items (e.g., Pulse)
        #  -> specific feature (e.g., mean of Pulse)
        features = group_features_by_where_item(features)
        features = group_features_by_entity(features)
    return features


def get_feature_values(fm):
    return Response(fm.to_csv(), mimetype="text/csv")


def get_feature_value_by_id(fm, direct_id):
    entry = fm.loc[direct_id].fillna('N/A').to_dict()
    return jsonify(entry)


class FeatureMeta(Resource):

    def get(self):
        """
        Get the schema of the features
        ---
        tags:
          - feature
        responses:
          200:
            description: The schema of the features.
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/FeatureSchema'
          400:
            $ref: '#/components/responses/ErrorMessage'
          500:
            $ref: '#/components/responses/ErrorMessage'
        """
        try:
            settings = current_app.settings
            res = get_feature_descriptions(settings['feature_list'], settings['entityset'])
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res


class FeatureMatrix(Resource):

    def get(self):
        """
        Get feature values of all patients.
        ---
        tags:
          - feature
        responses:
          200:
            description: A csv file containing feature values of all patients.
            content:
              text/csv:
                schema:
                  type: string
          500:
            $ref: '#/components/responses/ErrorMessage'
        """
        try:
            settings = current_app.settings
            res = get_feature_values(settings['feature_matrix'])
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res


class FeatureValues(Resource):

    def get(self, direct_id):
        """
        Get the feature values of a patient.
        ---
        tags:
          - feature
        parameters:
          - name: direct_id
            in: path
            schema:
              type: integer
            required: true
            description: ID of the target entity, e.g., patient id or admission id.
        responses:
          200:
            description: The schema of the features.
            content:
              application/json:
                schema:
                  type: object
                  additionalProperties:
                    oneOf:
                      - type: number
                        type: string
          500:
            $ref: '#/components/responses/ErrorMessage'
        """
        try:
            settings = current_app.settings
            res = get_feature_value_by_id(settings['feature_matrix'], direct_id)
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res

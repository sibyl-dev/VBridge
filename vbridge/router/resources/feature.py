import logging

from flask import current_app, jsonify
from flask_restful import Resource

from vbridge.utils import get_item_dict
from vbridge.utils import get_feature_description, group_features_by_entity, \
    group_features_by_where_item

LOGGER = logging.getLogger(__name__)


def get_feature_descriptions(fl, es=None, in_hierarchy=True):
    """Get the descriptions of each feature.

    Args:
        fl: list, a list of objects defining each features
        es: featuretools.EntitySet, the entity set that includes all patients' health records.
        in_hierarchy: boolean, whether to group the features

    Returns:
        A list of dicts describing features.
    """
    item_dict = get_item_dict(es) if es is not None else None
    features = [get_feature_description(f, item_dict) for f in fl]
    if in_hierarchy:
        # TODO: A sample grouping schema: entity (e.g., Vital Signs) -> items (e.g., Pulse)
        #  -> specific feature (e.g., mean of Pulse)
        features = group_features_by_where_item(features)
        features = group_features_by_entity(features)
    return features


def get_feature_values(fm):
    entries = fm.to_dict()
    return entries


def get_feature_value(fm, direct_id):
    entry = fm.loc[direct_id].fillna('N/A').to_dict()
    return entry


class FeatureSchema(Resource):

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
            description: The values of features for all patients.
            content:
              application/json:
                schema:
                  type: object
          500:
            $ref: '#/components/responses/ErrorMessage'
        """
        try:
            settings = current_app.settings
            res = get_feature_values(settings['feature_matrix'])
            res = jsonify(res)
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
              type: string
            required: true
            description: the identifier of the patient's related entry in the target entity
                (e.g., the admission id).
        responses:
          200:
            description: The value of features for the required patient.
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
            res = get_feature_value(settings['feature_matrix'], direct_id)
            res = jsonify(res)
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res

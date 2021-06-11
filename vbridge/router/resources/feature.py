import logging

from flask import Response, current_app, jsonify
from flask_restful import Resource

from vbridge.modeling.modeler import Modeler
from vbridge.router.resources.entity_set import get_item_dict

LOGGER = logging.getLogger(__name__)


def get_feature_schemas(fl, es):
    def get_leaf(feature):
        if len(feature.base_features) > 0:
            return get_leaf(feature.base_features[0])
        else:
            return feature

    def get_level2_leaf(feature):
        if len(feature.base_features) == 0:
            return None
        elif len(feature.base_features) > 0 and len(feature.base_features[0].base_features) == 0:
            return feature
        else:
            return get_level2_leaf(feature.base_features[0])

    features = []
    targets = []
    target_names = Modeler.prediction_targets()
    for f in fl:
        leaf_node = get_leaf(f)
        leve2_leaf_node = get_level2_leaf(f)
        info = {
            'id': f.get_name(),
            'primitive': leve2_leaf_node and leve2_leaf_node.primitive.name,
            'entityId': leaf_node.entity_id,
            'columnId': leaf_node.get_name(),
        }

        if leve2_leaf_node and ('where' in leve2_leaf_node.__dict__):
            entity_dict = get_item_dict(es, info['entityId'])
            filter_name = leve2_leaf_node.where.get_name()
            info['item'] = {
                'columnId': filter_name.split(' = ')[0],
                'itemId': filter_name.split(' = ')[1],
                'itemAlias': entity_dict.get(filter_name.split(' = ')[1], None)
            }
            info['alias'] = leve2_leaf_node.primitive.name
        else:
            info['alias'] = leaf_node.get_name()

        if '#' in f.get_name():
            period = f.get_name().split('#')[0]
            info['period'] = period
        else:
            info['period'] = 'others'

        if info['period'] == 'in-surgery':
            feature_type = 'In-surgery'
        elif info['period'] == 'pre-surgery':
            feature_type = 'Pre-surgery'
        else:
            if f.get_name() in ['Height', 'Weight', 'Age',
                                'ADMISSIONS.ICD10_CODE_CN',
                                'ADMISSIONS.PATIENTS.GENDER']:
                feature_type = 'Pre-surgery'
            else:
                feature_type = 'In-surgery'

        info['type'] = feature_type
        if info['id'] in target_names:
            targets.append(info)
        else:
            features.append(info)
    return {
        'targets': targets,
        'features': features
    }


def get_feature_matrix(fm):
    return Response(fm.to_csv(), mimetype="text/csv")


def get_feature_values(fm, subject_id):
    subject_id = int(subject_id)
    entry = fm.loc[subject_id].fillna('N/A').to_dict()
    return jsonify(entry)


class FeatureMeta(Resource):
    def __init__(self):
        self.fl = current_app.fl
        self.es = current_app.es

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
            res = get_feature_schemas(self.fl, self.es)
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res


class FeatureMatrix(Resource):
    def __init__(self):
        self.fm = current_app.fm

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
            res = get_feature_matrix(self.fm)
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res


class FeatureValues(Resource):
    def __init__(self):
        self.fm = current_app.fm

    def get(self, subject_id):
        """
        Get the feature values of a patient.
        ---
        tags:
          - feature
        parameters:
          - name: subject_id
            in: path
            schema:
              type: integer
            required: true
            description: ID of the target patient.
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
            res = get_feature_values(self.fm, subject_id)
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res

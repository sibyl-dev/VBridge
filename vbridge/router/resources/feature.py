import logging

from flask_restful import Resource
from flask import jsonify, current_app

from vbridge.modeling.modeler import Modeler

LOGGER = logging.getLogger(__name__)


def get_feature_meta(fl):

    def get_leaf(feature):
        if len(feature.base_features) > 0:
            return get_leaf(feature.base_features[0])
        else:
            return feature

    def get_level2_leaf(feature):
        if len(feature.base_features) == 0:
            return None
        elif len(feature.base_features) > 0 and \
                len(feature.base_features[0].base_features) == 0:
            return feature
        else:
            return get_level2_leaf(feature.base_features[0])

    feature_meta = []
    targets = Modeler.prediction_targets()
    for f in fl:
        if f.get_name() in targets:
            continue
        leaf_node = get_leaf(f)
        leve2_leaf_node = get_level2_leaf(f)
        info = {
            'name': f.get_name(),
            'whereItem': leve2_leaf_node.where.get_name().split(' = ')
            if leve2_leaf_node and ('where' in leve2_leaf_node.__dict__) else [],
            'primitive': leve2_leaf_node and leve2_leaf_node.primitive.name,
            'entityId': leaf_node.entity_id,
            'columnName': leaf_node.get_name(),
        }

        if len(info['whereItem']) > 0:
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
                                'ADMISSIONS.ICD10_CODE_CN', 'ADMISSIONS.PATIENTS.GENDER']:
                feature_type = 'Pre-surgery'
            else:
                feature_type = 'In-surgery'

        info['type'] = feature_type
        feature_meta.append(info)
    return jsonify(feature_meta)


class FeatureMeta(Resource):
    def __init__(self):
        self.fl = current_app.fl

    def get(self):
        try:
            res = get_feature_meta(self.fl)
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res

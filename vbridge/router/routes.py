from flasgger import Swagger
from flask_restful import Api

import vbridge.router.resources as res
from vbridge.router.swagger import swagger_tpl

API_VERSION = '/api/'


def add_routes(app):
    api = Api(app)

    Swagger(app, template=swagger_tpl, parse=True)

    # patient
    api.add_resource(res.patient.PatientStaticInfo, API_VERSION +
                     'patient_static_record/<string:subject_id>')
    api.add_resource(res.patient.PatientDynamicInfo, API_VERSION +
                     'patient_dynamic_record/<string:subject_id>')
    # cohort
    api.add_resource(res.patient_selection.PatientSelection, API_VERSION + 'patient_selection/')
    api.add_resource(res.patient_selection.SubjectIDs, API_VERSION + 'subject_ids/')
    # feature
    api.add_resource(res.feature.FeatureMeta, API_VERSION + 'feature_schema/')
    api.add_resource(res.feature.FeatureMatrix, API_VERSION + 'feature_matrix/')
    api.add_resource(res.feature.FeatureValues, API_VERSION + 'feature_values/<string:subject_id>')
    # entity-set
    api.add_resource(res.entity_set.EntitySchema, API_VERSION + 'entity_schema/')
    api.add_resource(res.entity_set.ItemDict, API_VERSION + 'item_dict/')
    api.add_resource(res.entity_set.EntityIDs, API_VERSION + 'table_names/')
    api.add_resource(res.entity_set.StaticRecordRange, API_VERSION + 'record_range/')
    api.add_resource(res.reference_value.ReferenceValue, API_VERSION + 'reference_value/')
    # model
    api.add_resource(res.model.PredictionTargets, API_VERSION + 'prediction_target/')
    api.add_resource(res.model.Prediction, API_VERSION + 'prediction/')
    # explanation
    api.add_resource(res.explanation.ShapValues, API_VERSION + 'shap_values/')
    api.add_resource(res.explanation.ShapValuesIfNormal, API_VERSION + 'what_if_shap_values/')
    api.add_resource(res.signal_explanation.SignalExplanation, API_VERSION + 'explain_signal/')

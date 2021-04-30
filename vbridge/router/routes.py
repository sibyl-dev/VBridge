from flask_restful import Api

import vbridge.router.resources as res

API_VERSION = '/api/'


def add_routes(app):
    api = Api(app)
    # patient
    api.add_resource(res.patient.PatientMeta, API_VERSION + 'patient_meta/')
    api.add_resource(res.patient.PatientRecords, API_VERSION + 'patient_records/')
    # patient selection
    api.add_resource(res.patient_selection.PatientSelection, API_VERSION + 'patient_group/')
    # reference values
    api.add_resource(res.reference_value.ReferenceValue, API_VERSION + 'reference_value/')
    # feature
    api.add_resource(res.feature.FeatureMeta, API_VERSION + 'feature_meta/')
    api.add_resource(res.feature.FeatureMatrix, API_VERSION + 'feature_matrix/')
    api.add_resource(res.feature.FeatureValues, API_VERSION + 'feature_values/')
    api.add_resource(res.feature.SubjectIDs, API_VERSION + 'available_ids/')
    # entity-set
    api.add_resource(res.entity_set.EntitySchema, API_VERSION + 'record_meta/')
    api.add_resource(res.entity_set.ItemDict, API_VERSION + 'item_dict/')
    api.add_resource(res.entity_set.EntityIDs, API_VERSION + 'table_names/')
    api.add_resource(res.entity_set.StaticRecordRange, API_VERSION + 'record_filterrange/')
    # model
    api.add_resource(res.model.PredictionTargets, API_VERSION + 'prediction_target/')
    api.add_resource(res.model.Prediction, API_VERSION + 'prediction/')
    # explanation
    api.add_resource(res.explanation.ShapValues, API_VERSION + 'shap_values/')
    api.add_resource(res.explanation.ShapValuesIfNormal, API_VERSION + 'what_if_shap_values/')
    api.add_resource(res.signal_explanation.SignalExplanation, API_VERSION + 'explain_signal/')

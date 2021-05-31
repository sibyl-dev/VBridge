from flasgger import Swagger
from flask import render_template
from flask_restful import Api

import vbridge.router.resources as res
from vbridge.router.swagger import swagger_config, swagger_tpl

API = '/api/'


def add_routes(app):

    @app.route('/redoc')
    def redoc():
        return render_template('redoc.html')

    api = Api(app)

    Swagger(app, config=swagger_config, template=swagger_tpl, parse=True)

    # patient
    api.add_resource(res.patient.StaticInfo, API + 'patient_statics/<string:subject_id>')
    api.add_resource(res.patient.TemporalInfo, API + 'patient_temporal/<string:subject_id>')
    # feature
    api.add_resource(res.feature.FeatureMeta, API + 'feature_schemas/')
    api.add_resource(res.feature.FeatureMatrix, API + 'feature_values/')
    api.add_resource(res.feature.FeatureValues, API + 'feature_values/<string:subject_id>')
    # entity-set
    api.add_resource(res.entity_set.EntitySetSchema, API + 'entity_schema/')
    api.add_resource(res.entity_set.EntitySchema, API + 'entity_schema/<string:entity_id>')
    api.add_resource(res.entity_set.StaticRecordRange, API + 'record_ranges/')
    # api.add_resource(res.entity_set.PatientSelection, API + 'patient_selection/')
    api.add_resource(res.entity_set.ReferenceValue, API + 'reference_values/<string:entity_id>')
    # model
    api.add_resource(res.model.Prediction, API + 'predictions/<string:subject_id>')
    # explanation
    api.add_resource(res.explanation.ShapValues, API + 'shap_values/<string:subject_id>')
    api.add_resource(res.explanation.ShapValuesIfNormal, API + 'counterfactual_shap_values/<string:subject_id>')
    api.add_resource(res.signal_explanation.SignalExplanation, API + 'signal_explanations/')

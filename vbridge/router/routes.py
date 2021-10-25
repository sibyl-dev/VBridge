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

    # task
    api.add_resource(res.task.Task, API + 'task/')

    # entity-set
    api.add_resource(res.entityset.EntitySetSchema, API + 'entity_schema/')
    api.add_resource(res.entityset.EntitySchema, API + 'entity_schema/<string:entity_id>')
    api.add_resource(res.reference_value.ReferenceValues, API + 'reference_values/')
    api.add_resource(res.reference_value.ReferenceValue, API + 'reference_values/<string'
                                                               ':entity_id>')
    # patient
    api.add_resource(res.patient.Info, API + 'patient/<string:direct_id>')
    api.add_resource(res.patient.StaticInfo, API + 'patient/statics/<string:direct_id>')
    api.add_resource(res.patient.TemporalInfo, API + 'patient/temporal/<string:direct_id>')

    # patient selection
    api.add_resource(res.cohort_selector.SelectorExtent, API + 'selector_extents/')
    # api.add_resource(res.patient_filter.PatientSelection, API + 'patient_selection/')

    # feature
    api.add_resource(res.feature.FeatureSchema, API + 'feature/schema/')
    api.add_resource(res.feature.FeatureMatrix, API + 'feature/values/')
    api.add_resource(res.feature.FeatureValues, API + 'feature/values/<string:direct_id>')

    # model
    api.add_resource(res.prediction.AllPrediction, API + 'prediction/')
    api.add_resource(res.prediction.Prediction, API + 'prediction/<string:direct_id>')

    # explanation
    api.add_resource(res.feature_explanation.ShapValues, API + 'shap/<string:direct_id>')
    api.add_resource(res.feature_explanation.WhatIfShapValues, API
                     + 'whatif_shap/<string:direct_id>')
    api.add_resource(res.signal_explanation.SignalExplanation, API + 'signal_explanations'
                                                                     '/<string:direct_id>')

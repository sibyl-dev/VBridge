from flask_restful import Api

import vbridge.router.resources as res


API_VERSION = '/api/'


def add_routes(app):
    api = Api(app)
    api.add_resource(res.patient.PatientMeta, API_VERSION + 'patient_meta/')
    api.add_resource(res.patient.PatientRecords, API_VERSION + 'patient_records/')

    api.add_resource(res.feature.FeatureMeta, API_VERSION + 'feature_meta/')

    api.add_resource(res.entity_set.RecordMeta, API_VERSION + 'record_meta/')
    api.add_resource(res.entity_set.ItemDict, API_VERSION + 'item_dict/')

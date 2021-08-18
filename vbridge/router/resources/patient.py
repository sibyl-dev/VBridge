import logging

from flask import Response, current_app, jsonify
from flask_restful import Resource, reqparse

from vbridge.data_loader.pic_schema import ignore_variables
from vbridge.utils import get_forward_attributes, get_records

LOGGER = logging.getLogger(__name__)


def get_patient_statics(es, entity_id, direct_id, forward_entities=None):
    return jsonify(get_forward_attributes(es, entity_id, direct_id, forward_entities))


def get_patient_temporal(es, entity_id, direct_id, target_entity_id, cutoff_times=None):
    df = es[entity_id].df
    subject_id = df.loc[direct_id]['SUBJECT_ID']
    records = get_records(es, entity_id, subject_id,
                          target_entity_id=target_entity_id, cutoff_times=cutoff_times)
    return Response(records.to_csv(), mimetype="text/csv")


class StaticInfo(Resource):

    def get(self, direct_id):
        """
        Get a patient's static information by ID
        ---
        tags:
          - patient
        parameters:
          - name: direct_id
            in: path
            schema:
              type: string
            required: true
            description: ID of the target patient.
        responses:
          200:
            description: The static information of the patient (e.g., gender).
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/PatientStatic'
          400:
            $ref: '#/components/responses/ErrorMessage'
          500:
            $ref: '#/components/responses/ErrorMessage'
        """
        try:
            settings = current_app.settings
            res = get_patient_statics(settings['entityset'], settings['target_entity'], direct_id)
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res


class TemporalInfo(Resource):
    def __init__(self):
        parser_get = reqparse.RequestParser(bundle_errors=True)
        parser_get.add_argument('entity_id', type=str, required=True, location='args')
        self.parser_get = parser_get

    def get(self, subject_id):
        """
        Get a patient's dynamic information by ID
        ---
        tags:
          - patient
        parameters:
          - name: subject_id
            in: path
            schema:
              type: string
            required: true
            description: ID of the target patient.
          - name: entity_id
            in: query
            schema:
              type: string
            required: true
            description: ID of the target entity.
        responses:
          200:
            description: The dynamic information of the patient (e.g., lab tests).
            content:
              text/csv:
                schema:
                  type: string
          400:
            $ref: '#/components/responses/ErrorMessage'
          500:
            $ref: '#/components/responses/ErrorMessage'
        """
        try:
            args = self.parser_get.parse_args()
            entity_id = args['entity_id']
        except Exception as e:
            LOGGER.exception(str(e))
            return {'message', str(e)}, 400

        try:
            settings = current_app.settings
            res = get_patient_temporal(settings['entityset'], entity_id, subject_id,
                                       settings['target_entity'], settings['cutoff_time'])
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res

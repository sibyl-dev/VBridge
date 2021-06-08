import logging

from flask import Response, current_app, jsonify
from flask_restful import Resource, reqparse

from vbridge.data_loader.data import get_patient_records

LOGGER = logging.getLogger(__name__)


def get_patient_statics(es, subject_id):
    # TODO: string ids
    subject_id = int(subject_id)
    info = {'subjectId': subject_id}
    table_names = ['PATIENTS', 'ADMISSIONS', 'SURGERY_INFO']
    for table_name in table_names:
        df = es[table_name].df
        records = df[df['SUBJECT_ID'] == subject_id]
        column_names = es[table_name].df.columns
        for col in column_names:
            info[col] = str(records[col].values[0])
    return jsonify(info)


def get_patient_temporal(es, subject_id, table_name):
    # TODO: string ids
    subject_id = int(subject_id)
    cutoff_times = current_app.cutoff_times
    records = get_patient_records(es, table_name, subject_id, cutoff_times=cutoff_times)
    return Response(records.to_csv(), mimetype="text/csv")


class StaticInfo(Resource):

    def __init__(self):
        self.es = current_app.es

    def get(self, subject_id):
        """
        Get a patient's static information by ID
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
            res = get_patient_statics(self.es, subject_id)
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res


class TemporalInfo(Resource):
    def __init__(self):
        self.es = current_app.es

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
        except Exception as e:
            LOGGER.exception(str(e))
            return {'message', str(e)}, 400

        table_name = args['entity_id']

        try:
            res = get_patient_temporal(self.es, subject_id, table_name)
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res

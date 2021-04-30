import logging

from flask_restful import Resource, reqparse
from flask import jsonify, current_app, Response

from vbridge.data_loader.data import get_patient_records

LOGGER = logging.getLogger(__name__)


def get_patient_meta(es, subject_id):
    info = {'SubjectId': subject_id}
    table_names = ['PATIENTS', 'ADMISSIONS', 'SURGERY_INFO']
    for i, table_name in enumerate(table_names):
        hadm_df = es[table_name].df
        record = hadm_df[hadm_df['SUBJECT_ID'] == subject_id]
        column_names = es[table_name].df.columns
        for i, col in enumerate(column_names):
            info[col] = str(record[col].values[0])

    return jsonify(info)


def get_individual_records(es, subject_id, table_name):
    cutoff_times = current_app.cutoff_times
    records = get_patient_records(es, table_name, subject_id, cutoff_times=cutoff_times)

    return Response(records.to_csv(), mimetype="text/csv")


class PatientMeta(Resource):

    def __init__(self):
        self.es = current_app.es
        parser_get = reqparse.RequestParser(bundle_errors=True)
        parser_get.add_argument('subject_id', type=int, required=True, location='args')
        self.parser_get = parser_get

    def get(self):
        """
        Get a patient's basic information by ID
        ---
        tags:
          - patient
        parameters:
          - name: subject_id
            schema:
              type: string
        """
        try:
            args = self.parser_get.parse_args()
            print(args)
        except Exception as e:
            LOGGER.exception(str(e))
            return {'message', str(e)}, 400

        subject_id = args['subject_id']
        try:
            res = get_patient_meta(self.es, subject_id)
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res


class PatientRecords(Resource):

    def __init__(self):
        self.es = current_app.es

        parser_get = reqparse.RequestParser(bundle_errors=True)
        parser_get.add_argument('subject_id', type=int, required=True, location='args')
        parser_get.add_argument('table_name', type=str, required=True, location='args')
        self.parser_get = parser_get

    def get(self):
        """
        """
        try:
            args = self.parser_get.parse_args()
            print(args)
        except Exception as e:
            LOGGER.exception(str(e))
            return {'message', str(e)}, 400

        subject_id = args['subject_id']
        table_name = args['table_name']

        try:
            res = get_individual_records(self.es, subject_id, table_name)
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res

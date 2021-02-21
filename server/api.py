import logging

from flask import request, jsonify, Blueprint, current_app, Response

from model.data import get_patient_records
from model.settings import interesting_variables, META_INFO

api = Blueprint('api', __name__)

logger = logging.getLogger('api')


class ApiError(Exception):
    """
    API error handler Exception
    See: http://flask.pocoo.org/docs/0.12/patterns/apierrors/
    """
    status_code = 400

    def __init__(self, message, status_code=None, payload=None):
        Exception.__init__(self)
        self.message = message
        if status_code is not None:
            self.status_code = status_code
        self.payload = payload

    def to_dict(self):
        rv = dict(self.payload or ())
        rv['message'] = self.message
        return rv


@api.errorhandler(ApiError)
def handle_invalid_usage(error):
    logging.exception(error)
    response = jsonify(error.to_dict())
    response.status_code = error.status_codes
    return response


@api.route('/individual_records', methods=['GET'])
def get_individual_records():
    table_name = request.args.get('table_name')
    subject_id = int(request.args.get('subject_id'))
    es = current_app.es
    cutoff_times = current_app.cutoff_times
    records = get_patient_records(es, table_name, subject_id, cutoff_times=cutoff_times)

    return Response(records.to_csv(), mimetype="text/csv")

@api.route('/patient_meta', methods=['GET'])
def get_patient_meta():
    subject_id = int(request.args.get('subject_id'))
    info = {'subjectId': subject_id}
    es = current_app.es
    cutoff_times = current_app.cutoff_times
    hadm_df = es["ADMISSIONS"].df
    info['startDate'] = str(hadm_df[hadm_df['SUBJECT_ID'] == subject_id]['ADMITTIME'].values[0])
    info['endDate'] = str(cutoff_times[cutoff_times['SUBJECT_ID'] == subject_id]['time'].values[0])
    return jsonify(info)


@api.route('/record_meta', methods=['GET'])
def get_record_meta():
    table_name = request.args.get('table_name')
    info = { 'name': table_name }
    if table_name in META_INFO:
        table_info = META_INFO[table_name]
        info['time_index'] = table_info['time_index']
        column_names = interesting_variables[table_name]
        df = current_app.es[table_name].df
        # distinguish "categorical" and "numerical" columns
        info['types'] = ['categorical' if df[name].dtype == object
            else 'numerical' for name in column_names]
        for i, col in enumerate(column_names):
            if col == table_info.get("time_index") or col in table_info.get("secondary_index", []):
                info['types'][i] = 'timestamp'

    return jsonify(info)

@api.route('/table_names', methods=['GET'])
def get_table_names():
    table_names = ['LABEVENTS', 'SURGERY_VITAL_SIGNS', 'CHARTEVENTS', 'PRESCRIPTIONS', 
        'MICROBIOLOGYEVENTS']
    return jsonify(table_names)

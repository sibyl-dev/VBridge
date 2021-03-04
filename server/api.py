import logging
import json

from flask import request, jsonify, Blueprint, current_app, Response

from model.data import get_patient_records
from model.settings import interesting_variables, META_INFO, filter_variable

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


@api.route('available_ids', methods=['GET'])
def get_available_ids():
    es = current_app.es
    subjects_ids = es["SURGERY_INFO"].df["SUBJECT_ID"].values[-20:].tolist()
    return jsonify(subjects_ids)


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
    # print('hadm_df', hadm_df[hadm_df['SUBJECT_ID'] == subject_id])
    info['startDate'] = str(hadm_df[hadm_df['SUBJECT_ID'] == subject_id]['ADMITTIME'].values[0])
    info['endDate'] = str(cutoff_times[cutoff_times['SUBJECT_ID'] == subject_id]['time'].values[0])
    
    patient_df = es["PATIENTS"].df
    info['GENDER'] = patient_df[patient_df['SUBJECT_ID'] == subject_id]['GENDER'].values[0]
    info['DOB'] = str(patient_df[patient_df['SUBJECT_ID'] == subject_id]['DOB'].values[0])
    
    return jsonify(info)

@api.route('/patientinfo_meta', methods=['GET'])
def get_patientinfo_meta():
    subject_id = int(request.args.get('subject_id'))
    
    info = {'subjectId': subject_id}
    es = current_app.es
    cutoff_times = current_app.cutoff_times
    

    table_names = ['PATIENTS', 'ADMISSIONS', 'SURGERY_INFO']
    for i, table_name in enumerate(table_names):
        # print('table_names', table_name)
        hadm_df = es[table_name].df
        record = hadm_df[hadm_df['SUBJECT_ID'] == subject_id]
        column_names = interesting_variables[table_name]
        print('column_names', column_names)
        for i, col in enumerate(column_names):
            info[col] = str(record[col].values[0])
    # print('patientinfo_meta', info)

    return jsonify(info)


@api.route('/record_filterrange', methods=['GET'])
def get_record_filterrange():
    
    table_names = ['PATIENTS', 'ADMISSIONS', 'SURGERY_INFO']
    info = {'name': 'filter_range'}

    for i, table_name in enumerate(table_names):
        column_names = filter_variable[table_name]
        df = current_app.es[table_name].df
        for j, filter_name in enumerate(column_names):                
            all_records = list(set(df[filter_name]))

            if(filter_name == 'SURGERY_NAME'):
                temp_records = []
                for item in all_records:
                    temp_records = temp_records + item.split('+')
                all_records = list(set(temp_records))
            if(filter_name == 'SURGERY_POSITION'):
                temp_records = []
                for item in all_records:
                    temp_records = temp_records + item.split(',')
                all_records = list(set(temp_records))

            # categorical
            if(df[filter_name].dtype == object):
                all_records.sort()
                info[filter_name] = all_records
            else:
                info[filter_name] = [min(all_records), max(all_records)]

    return jsonify(info)

@api.route('/patient_group', methods=['GET'])
def get_patient_group():
    conditions = json.loads(request.args.get('filterConditions'))
    print('conditions', conditions)
    table_names = ['PATIENTS', 'ADMISSIONS', 'SURGERY_INFO']
    # for condition_name in conditions:
    #     print(condition_name)
    subject_idG = []
    for i, table_name in enumerate(table_names):
        column_names = filter_variable[table_name]
        es = current_app.es
        hadm_df = es[table_name].df
        filter_nameG = []

        for condition_name in conditions:
            if(condition_name in column_names):
                # filter_nameG.append(str(condition_name))
                if (type(conditions[condition_name][0])=='string' or 'complication' in condition_name):
                    print('hahaha',hadm_df[hadm_df[condition_name] in conditions[name]]['subject_id'])

                    subject_idG.append(hadm_df[hadm_df[condition_name] in conditions[name]]['subject_id'].values[0])
                else:
                    print('hahaha',hadm_df[hadm_df[condition_name] <= conditions[condition_name][1] and hadm_df[condition_name] >= conditions[condition_name][0]]['subject_id'])

                    subject_idG.append((hadm_df[hadm_df[condition_name] <= conditions[condition_name][1] and hadm_df[condition_name] >= conditions[condition_name][0]]['subject_id'].values[0]).any())
        print('subject_idG', subject_idG)

        # if(len(filter_nameG)!=0):
            # flag = [ hadm_df[name] in conditions[name] 
            #         if (type(conditions[name][0])=='string' or 'complication' in name) 
            #         else (hadm_df[name] <= conditions[name][1] and hadm_df[name] >= conditions[name][0] ) 
            #         for name in filter_nameG]
            # print('flag', flag)
            # subject_idG = hadm_df[flag]['subject_id']
            # print(table_name, subject_idG)


    return ''


@api.route('/record_meta', methods=['GET'])
def get_record_meta():
    table_name = request.args.get('table_name')
    info = {'name': table_name}
    if table_name in META_INFO:
        table_info = META_INFO[table_name]
        info['time_index'] = table_info.get('time_index')
        info['item_index'] = table_info.get('item_index')
        info['value_indexes'] = table_info.get('value_indexes')
        info['alias'] = table_info.get('alias')
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
                   'MICROBIOLOGYEVENTS', 'INPUTEVENTS', 'OUTPUTEVENTS']
    return jsonify(table_names)


@api.route('/feature_meta', methods=['GET'])
def get_feature_meta():
    fl = current_app.fl
    feature_meta = [{'name': f.get_name()} for f in fl]
    return jsonify(feature_meta)

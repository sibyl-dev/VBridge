import logging

import json
import numpy as np

from flask.json import JSONEncoder
from flask import request, jsonify, Blueprint, current_app, Response

from model.data import get_patient_records
from model.modeler import Modeler
from model.settings import interesting_variables, META_INFO, filter_variable

api = Blueprint('api', __name__)

logger = logging.getLogger('api')


# From https://stackoverflow.com/questions/50916422/python-typeerror-object-of-type-int64-is-not
# -json-serializable
class NpEncoder(JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        else:
            return super(NpEncoder, self).default(obj)


api.json_encoder = NpEncoder


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
    # print('conditions', conditions)

    table_names = ['PATIENTS', 'ADMISSIONS', 'SURGERY_INFO']
    number_vari = ['Age',  'Height', 'Weight', 'Surgical time (minutes)']
    # for condition_name in conditions:
    #     print(condition_name)
    filterList = []
    es = current_app.es
    df = es['SURGERY_INFO'].df
    flags = False

    # print('teststst',df[(df['Age']>=conditions['Age'][0]) &  (df['Age']<=conditions['Age'][1])] )
    for i, table_name in enumerate(table_names):
        column_names = filter_variable[table_name]
        hadm_df = es[table_name].df

        for condition_name in conditions:
            if(condition_name in column_names):
                flags = True
                if(condition_name in number_vari):
                    print('here', type(hadm_df[condition_name]), hadm_df[condition_name])
                    hadm_df = hadm_df[(hadm_df[condition_name]>=conditions[condition_name][0]) &  (hadm_df[condition_name]<=conditions[condition_name][1])]
                elif(condition_name == 'SURGERY_NAME'):
                    hadm_df['test'] = (hadm_df[condition_name].str).split('+') + conditions[condition_name]
                    # print('here', hadm_df['test'])
                    hadm_df = hadm_df[len(hadm_df[condition_name] +  conditions[condition_name]) != len(list( hadm_df[condition_name] +  conditions[condition_name]))]
                elif(condition_name == 'SURGERY_POSITION'):
                    hadm_df = hadm_df[((hadm_df[condition_name]).split(',')).any() in conditions[condition_name] ]
                else:
                    flag = (hadm_df[condition_name] == conditions[condition_name][0])
                    for i, value  in enumerate(conditions[condition_name]):
                        print('value', value, i)
                        if(i == 0):
                            continue
                        flag = (flag) | (hadm_df[condition_name] == conditions[condition_name][i])
                        hadm_df_ = hadm_df[flag]
                    # print('here', type(hadm_df[condition_name]), hadm_df[condition_name])
                    # print('here', type(conditions[condition_name]), conditions[condition_name])
                    # hadm_df = hadm_df[ np.any(hadm_df[condition_name] == conditions[condition_name]) ]
                    # hadm_df = hadm_df[(conditions[condition_name].count(hadm_df[condition_name])>0).any()]

        # if(flags):
        #     print('filter', hadm_df['subject_id'])
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
    # TODO: the code may only works for depth<=2 features
    feature_meta = []
    targets = Modeler.prediction_targets()
    for f in fl:
        if f.get_name() in targets:
            continue
        info = {
            'name': f.get_name(),
            'where_item': f.where.get_name().split(' = ') if 'where' in f.__dict__ else [],
            'primitive': f.primitive.name
        }
        if 'child_entity' in f.__dict__:
            info['end_entity'] = f.child_entity.id
        elif 'parent_entity' in f.__dict__:
            info['end_entity'] = f.parent_entity.id
        else:
            info['end_entity'] = 'SURGERY_INFO'

        if len(f.base_features) == 0:
            alias = f.get_name()
        elif 'where' in f.__dict__:
            alias = f.where.get_name().split(' = ')[-1]
        else:
            alias = f.base_features[0].get_name()
        if f.primitive.name:
            alias = "{}({})".format(f.primitive.name, alias)
        info['alias'] = alias

        feature_meta.append(info)
    return jsonify(feature_meta)


@api.route('/prediction_target', methods=['GET'])
def get_prediction_target():
    return jsonify(Modeler.prediction_targets())


@api.route('/prediction', methods=['GET'])
def get_prediction():
    subject_id = int(request.args.get('subject_id'))
    predictions = current_app.model_manager.predict_proba(subject_id)
    # return jsonify([{'target': k, 'value': float(v)} for k, v in predictions.items()])
    return jsonify(predictions)


@api.route('/feature_values', methods=['GET'])
def get_feature_values():
    subject_id = int(request.args.get('subject_id'))
    entry = current_app.fm.loc[subject_id].fillna('N/A').to_dict()
    return jsonify(entry)


@api.route('/shap_values', methods=['GET'])
def get_shap_values():
    subject_id = int(request.args.get('subject_id'))
    target = request.args.get('target')
    shap_values = current_app.model_manager.explain(subject_id, target)
    return jsonify(shap_values.loc[0].to_dict())

import logging
import math
import json
import csv
import numpy as np

import numpy as np
from flask.json import JSONEncoder
from flask import request, jsonify, Blueprint, current_app, Response

from model.data import get_patient_records
from model.modeler import Modeler
from model.settings import interesting_variables, META_INFO, filter_variable, fm_category_name, \
    complication_type
from sklearn.metrics.pairwise import cosine_similarity

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


def formalize(x):
    x1 = x.copy(deep=True)


@api.errorhandler(ApiError)
def handle_invalid_usage(error):
    logging.exception(error)
    response = jsonify(error.to_dict())
    response.status_code = error.status_codes
    return response


@api.route('available_ids', methods=['GET'])
def get_available_ids():
    es = current_app.es
    df = es["SURGERY_INFO"].df
    subjects_ids = df[df['complication'] == 1]["SUBJECT_ID"].values[:30].tolist()
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
        # print('column_names', column_names)
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

            if filter_name == 'SURGERY_NAME':
                temp_records = []
                for item in all_records:
                    temp_records = temp_records + item.split('+')
                all_records = list(set(temp_records))
            if filter_name == 'SURGERY_POSITION':
                temp_records = []
                for item in all_records:
                    temp_records = temp_records + item.split(',')
                all_records = list(set(temp_records))

            # categorical
            if df[filter_name].dtype == object:
                all_records.sort()
                info[filter_name] = all_records
            else:
                info[filter_name] = [min(all_records), max(all_records)]

    return jsonify(info)


@api.route('/patient_group', methods=['GET'])
def get_patient_group():
    conditions = json.loads(request.args.get('filterConditions'))
    subject_id = int(request.args.get('subject_id'))

    table_names = ['PATIENTS', 'SURGERY_INFO', 'ADMISSIONS']
    number_vari = ['Age', 'Height', 'Weight', 'Surgical time (minutes)']

    es = current_app.es
    subject_idG = list(current_app.fm.index)
    info = {'subject_idG': subject_idG}

    # filter subject_idG according to the conditions
    for i, table_name in enumerate(table_names):
        column_names = filter_variable[table_name]
        hadm_df = es[table_name].df
        tableFlag = False
        for condition_name in conditions:
            if condition_name in column_names:
                tableFlag = True
                hasFilter = True
                if condition_name in number_vari:
                    hadm_df = hadm_df[
                        (hadm_df[condition_name] >= conditions[condition_name][0]) & (
                                    hadm_df[condition_name] <= conditions[condition_name][1])]

                elif condition_name == 'SURGERY_NAME' or condition_name == 'SURGERY_POSITION':
                    tmpDf = hadm_df[condition_name]
                    flag = tmpDf.apply(
                        lambda x: np.array([t in x for t in conditions[condition_name]]).any())
                    hadm_df = hadm_df[flag]

                else:
                    hadm_df = hadm_df[hadm_df[condition_name].isin(conditions[condition_name])]

        if tableFlag:
            if len(subject_idG) != 0:
                hadm_df = hadm_df[hadm_df['SUBJECT_ID'].isin(subject_idG)]
            subject_idG = hadm_df['SUBJECT_ID'].drop_duplicates().values.tolist()

    fm_ = current_app.fm
    # r = fm_.loc[8511]
    if subject_id:
        r = fm_.loc[subject_id]
        # r = r.drop(complication_type)
    fm = fm_[fm_.index.isin(subject_idG)]
    fm = fm.fillna(0)

    # contact the prediction result, calculate the prediction truth
    info['distribution'] = [np.sum(fm['lung complication']), np.sum(fm['cardiac complication']),
         np.sum(fm['arrhythmia complication']), np.sum(fm['infectious complication']),
         np.sum(fm['other complication'])]
    info['predictionG'] = list((fm['lung complication'].astype('str')).str.cat(
        [fm['cardiac complication'].astype('str'), fm['arrhythmia complication'].astype('str'),
         fm['infectious complication'].astype('str'), fm['other complication'].astype('str')],
        sep='-'))
    info['subject_idG'] = list(subject_idG)

    # calculate the similarty
    # if subject_id!=0:
    #     similarity = fm.copy(deep=True)
    #     similarity = similarity.fillna(0)
    #     similarity = similarity.drop(complication_type, axis=1)
    #     for t in fm_category_name:
    #         r[t] = 1
    #         similarity[t] = similarity[t].apply(lambda x: 1 if x==r[t] else 0)

    # x = similarity.apply(lambda x: cosine_similarity(np.array(x).reshape(1,-1), np.array(
    # r).reshape(1,-1))[0][0], axis=1)

    #     info['similarty'] = list(x)

    #     # sort by the similarity
    #     list_of_tuples = list(zip(list(subject_idG), info['predictionG'], list(x)))
    #     list_of_tuples = sorted(list_of_tuples, key=lambda s: s[2], reverse=True)
    #     subject_idG, predictionG, x = zip(*list_of_tuples)
    #     info['subject_idG'] = list(subject_idG)
    #     info['predictionG'] = list(predictionG)
    #     info['similarity'] = list(x)

    current_app.subject_idG = subject_idG
    return jsonify(info)


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

    def get_leaf(feature):
        if len(feature.base_features) > 0:
            return get_leaf(feature.base_features[0])
        else:
            return feature

    def get_level2_leaf(feature):
        if len(feature.base_features) == 0:
            return None
        elif len(feature.base_features) > 0 and \
                len(feature.base_features[0].base_features) == 0:
            return feature
        else:
            return get_level2_leaf(feature.base_features[0])

    feature_meta = []
    targets = Modeler.prediction_targets()
    for f in fl:
        if f.get_name() in targets:
            continue
        leaf_node = get_leaf(f)
        leve2_leaf_node = get_level2_leaf(f)
        info = {
            'name': f.get_name(),
            'whereItem': leve2_leaf_node.where.get_name().split(' = ') \
                if leve2_leaf_node and ('where' in leve2_leaf_node.__dict__) else [],
            'primitive': leve2_leaf_node and leve2_leaf_node.primitive.name,
            'entityId': leaf_node.entity_id,
            'columnName': leaf_node.get_name(),
        }

        if len(info['whereItem']) > 0:
            info['alias'] = leve2_leaf_node.primitive.name
        else:
            info['alias'] = leaf_node.get_name()

        # type: 'Surgery Observations' | 'Pre-surgery Observations' | 
        # 'Pre-surgery Treatments' | 'Surgery Info' | 'Patient Info'
        if '#' in f.get_name():
            period = f.get_name().split('#')[0]
            if period == 'in-surgery':
                feature_type = 'Surgery Observations'
            elif period == 'pre-surgery':
                if info['entityId'] == 'PRESCRIPTIONS':
                    feature_type = 'Pre-surgery Treatments'
                else:
                    feature_type = 'Pre-surgery Observations'
        else:
            if f.get_name() in ['Height', 'Weight', 'Age', 'ADMISSIONS.ICD10_CODE_CN', 'ADMISSIONS.PATIENTS.GENDER']:
                feature_type = 'Patient Info'
            else:
                feature_type = 'Surgery Info'
        info['type'] = feature_type
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


@api.route('/feature_matrix', methods=['GET'])
def get_feature_matrix():
    return Response(current_app.fm[current_app.fm.index.isin(current_app.subject_idG)].to_csv(),
                    mimetype="text/csv")


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


@api.route('/item_dict', methods=['GET'])
def get_item_dict():
    item_dict = {}
    for group in current_app.es['D_ITEMS'].df.groupby('LINKSTO'):
        items = group[1].loc[:, ['LABEL', 'LABEL_CN']]
        table_name = group[0].upper()
        item_dict[table_name] = items.to_dict('index')

    item_dict['LABEVENTS'] = current_app.es['D_LABITEMS'].df.loc[:, ['LABEL', 'LABEL_CN']].to_dict(
        'index')

    return jsonify(item_dict)


@api.route('/reference_value', methods=['GET'])
def get_reference_value():
    table_name = request.args.get('table_name')
    column_name = request.args.get('column_name')
    table_info = META_INFO[table_name]
    references = {}
    df = current_app.es[table_name].df
    filter_df = df[df['SUBJECT_ID'].isin(current_app.subject_idG)]
    print('filter_df', len(filter_df))
    for group in filter_df.groupby(table_info.get('item_index')):
        item_name = group[0]
        mean, count, std = group[1][column_name].agg(['mean', 'count', 'std'])
        references[item_name] = {
            'mean': 0 if np.isnan(mean) else mean,
            'std': 0 if np.isnan(std) else std,
            'count': 0 if np.isnan(count) else count,
            'ci95': [0 if np.isnan(mean - 1.960 * std) else (mean - 1.960 * std),
                     0 if np.isnan(mean + 1.960 * std) else (mean + 1.960 * std)]
        }
    # print('final reference_value', references)
    return jsonify(references)

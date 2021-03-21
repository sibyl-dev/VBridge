import logging
import json

import numpy as np
import pandas as pd
from flask.json import JSONEncoder
from flask import request, jsonify, Blueprint, current_app, Response

from model.data import get_patient_records
from model.modeler import Modeler
from model.settings import interesting_variables, META_INFO, filter_variable, filter_variable1

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
    fm = current_app.fm
    subjects_ids = fm.index
    # subjects_ids = fm[fm['complication'] == 1].index
    # subjects_ids = filter_group.index
    print('available_ids', subjects_ids)

    df = es["SURGERY_INFO"].df
    subjects_ids1 = df[(df['complication'] == 1) & (df['SUBJECT_ID'].isin(subjects_ids))][
                        "SUBJECT_ID"].values[:30].tolist()
    print('available_ids', subjects_ids1)

    return jsonify(subjects_ids1)


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
    hadm_df = es["ADMISSIONS"].df
    surgery_df = es["SURGERY_INFO"].df
    # print('hadm_df', hadm_df[hadm_df['SUBJECT_ID'] == subject_id])
    info['AdmitTime'] = str(hadm_df[hadm_df['SUBJECT_ID'] == subject_id]['ADMITTIME'].values[0])
    info['SurgeryEndTime'] = str(
        surgery_df[surgery_df['SUBJECT_ID'] == subject_id]['SURGERY_END_TIME'].values[0])
    info['SurgeryBeginTime'] = str(
        surgery_df[surgery_df['SUBJECT_ID'] == subject_id]['SURGERY_BEGIN_TIME'].values[0])

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
    info = {'name': 'filter_range'}
    fm = current_app.fm

    for i, filter_name in enumerate(filter_variable):
        # categorical
        if filter_name == 'GENDER':
            info[filter_name] = ['F', 'M']
        elif filter_name == 'Age':
            info[filter_name] = ['< 1 month', '1-3 months', '3 months-1 year', '> 1 year']
            all_records = list(set(fm[filter_name]))
            info['age'] = [min(all_records), max(all_records)]
        elif filter_name == 'SURGERY_NAME':
            all_records = []
            for surgeryname in fm[filter_name]:
                all_records = all_records + surgeryname
            # print(filter_name, all_records)
            info[filter_name] = list(set(all_records))
        elif fm[filter_name].dtype == object:
            all_records = list(set(fm[filter_name]))
            all_records.sort()
            info[filter_name] = all_records
        else:
            all_records = list(set(fm[filter_name]))
            info[filter_name] = [min(all_records), max(all_records)]
    print('filterRange', info)
    return jsonify(info)


@api.route('/patient_group', methods=['GET'])
def get_patient_group():
    conditions = json.loads(request.args.get('filterConditions'))
    setSubjectIdG = request.args.get('setSubjectIdG')

    table_names = ['PATIENTS', 'SURGERY_INFO', 'ADMISSIONS']
    number_vari = ['Height', 'Weight', 'Surgical time (minutes)']

    es = current_app.es
    fm = current_app.fm
    subject_idG = fm.index.to_list()

    info = {'subject_idG': subject_idG}
    # print('conditions', conditions)

    # filter subject_idG according to the conditions
    for i, table_name in enumerate(table_names):
        column_names = filter_variable1[table_name]
        df = es[table_name].df
        df = df[df['SUBJECT_ID'].isin(subject_idG)]
        for item, value in conditions.items():
            if item in column_names:
                print('conditions', item, value)
                if item in number_vari:
                    df = df[(df[item] >= value[0]) & (df[item] <= value[1])]
                elif item == 'Age':
                    filter_flag = False
                    if '< 1 month' in value:
                        filter_flag = filter_flag | (df[item] <= 1)
                    if '1-3 months' in value:
                        filter_flag = filter_flag | (df[item] >= 1) & (df[item] <= 3)
                    if '3 months-1 year' in value:
                        filter_flag = filter_flag | (df[item] >= 3) & (df[item] <= 12)
                    if '> 1 year' in value:
                        filter_flag = filter_flag | (df[item] >= 12)
                    df = df[filter_flag]
                elif item == 'SURGERY_NAME':
                    # do nothing when he is []
                    df = df[df.apply(lambda x: np.array([t in x[item] for t in value]).all(),
                                     axis='columns')]
                elif item == 'SURGERY_POSITION':
                    df = df[df.apply(lambda x: np.array([t in x[item] for t in value]).any(),
                                     axis='columns')]
                elif item == 'GENDER':
                    df = df[df[item].isin(value)]
                else:
                    raise UserWarning("Condition: {} will not be considered.".format(item))

        subject_idG = df['SUBJECT_ID'].drop_duplicates().values.tolist()

    fm = fm[fm.index.isin(subject_idG)]

    # contact the prediction result, calculate the prediction truth
    info['labelCounts'] = [np.sum(fm['lung complication']),
                           np.sum(fm['cardiac complication']),
                           np.sum(fm['arrhythmia complication']),
                           np.sum(fm['infectious complication']),
                           np.sum(fm['other complication']),
                           len(subject_idG) - np.sum(fm['complication'])]
    info['ids'] = subject_idG

    if setSubjectIdG:
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
    # table_names = ['LABEVENTS', 'SURGERY_VITAL_SIGNS', 'CHARTEVENTS', 'PRESCRIPTIONS',
    #                'MICROBIOLOGYEVENTS', 'INPUTEVENTS', 'OUTPUTEVENTS']
    table_names = ['LABEVENTS', 'SURGERY_VITAL_SIGNS', 'CHARTEVENTS', 'PRESCRIPTIONS']
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

        if '#' in f.get_name():
            period = f.get_name().split('#')[0]
            info['period'] = period
        else:
            info['period'] = 'others'

        if info['period'] == 'in-surgery':
            feature_type = 'In-surgery Observations'
        elif info['period'] == 'pre-surgery':
            if info['entityId'] == 'PRESCRIPTIONS':
                feature_type = 'Pre-surgery Treatments'
            else:
                feature_type = 'Pre-surgery Observations'
        else:
            if f.get_name() in ['Height', 'Weight', 'Age',
                                'ADMISSIONS.ICD10_CODE_CN', 'ADMISSIONS.PATIENTS.GENDER']:
                feature_type = 'Patient Information'
            else:
                feature_type = 'Surgery Information'
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
    # print('get_feature_matrix', len(current_app.subject_idG))
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
    shap_values = current_app.model_manager.explain(id=subject_id, target=target)
    return jsonify(shap_values.loc[0].to_dict())


@api.route('/what_if_shap_values', methods=['GET'])
def get_what_if_shap_values():
    subject_id = int(request.args.get('subject_id'))
    target = request.args.get('target')
    shap_values = {}
    fm = current_app.fm
    if current_app.subject_idG:
        fm = fm.loc[current_app.subject_idG]
    model_manager = current_app.model_manager
    targets = Modeler.prediction_targets()
    stat = fm.agg(['mean', 'count', 'std']).T
    stat['ci95_low'] = stat['mean'] - stat['std'] * 1.96
    stat['ci95_high'] = stat['mean'] + stat['std'] * 1.96
    # stat['ci95_low'] = stat['mean'] - stat['std']
    # stat['ci95_high'] = stat['mean'] + stat['std']
    target_fv = fm.loc[subject_id]

    # What-if analysis on out-of-distribution high values
    high_features = target_fv[target_fv > stat['ci95_high']].index
    high_features = [f for f in high_features if f not in targets]
    if len(high_features) > 0:
        high_fm = pd.DataFrame(
            target_fv.values.repeat(len(high_features)).reshape(-1, len(high_features)),
            columns=high_features, index=fm.columns)
        for feature in high_features:
            high_fm.loc[feature, feature] = stat.loc[feature]['ci95_high']
        results = model_manager.explain(X=high_fm.T, target=target)
        for i, feature in enumerate(high_features):
            shap_values[feature] = results.loc[i, feature]

    # What-if analysis on out-of-distribution low values
    low_features = target_fv[target_fv < stat['ci95_low']].index
    low_features = [f for f in low_features if f not in targets]
    if len(low_features) > 0:
        low_fm = pd.DataFrame(
            target_fv.values.repeat(len(low_features)).reshape(-1, len(low_features)),
            columns=low_features, index=fm.columns)
        for feature in low_features:
            low_fm.loc[feature, feature] = stat.loc[feature]['ci95_low']
        results = model_manager.explain(X=low_fm.T, target=target)
        for i, feature in enumerate(low_features):
            shap_values[feature] = results.loc[i, feature]
    return jsonify(shap_values)


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
    group_ids = request.args.get('group_ids')
    table_info = META_INFO[table_name]
    references = {}
    df = current_app.es[table_name].df
    filter_df = df[df['SUBJECT_ID'].isin(current_app.subject_idG)]
    print(len(filter_df))
    for group in filter_df.groupby(table_info.get('item_index')):
        item_name = group[0]
        mean, count, std = group[1][column_name].agg(['mean', 'count', 'std'])
        references[item_name] = {
            'mean': 0 if np.isnan(mean) else mean,
            'std': 0 if np.isnan(std) else std,
            'count': 0 if np.isnan(count) else count,
            'ci95': [0 if np.isnan(mean - 1.960 * std) else (mean - 1.960 * std),
                     0 if np.isnan(mean + 1.960 * std) else (mean + 1.960 * std)]
            # 'ci95': [0 if np.isnan(mean - std) else (mean - std),
            #          0 if np.isnan(mean + std) else (mean + std)]
        }
    # print('final reference_value', references)
    return jsonify(references)

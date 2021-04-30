import logging
import json

import numpy as np
import pandas as pd
import featuretools as ft
from flask.json import JSONEncoder
from flask import request, jsonify, Blueprint, current_app, Response

from vbridge.data_loader.data import get_patient_records
from vbridge.modeling.modeler import Modeler
from vbridge.data_loader.settings import META_INFO, filter_variables

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
        elif isinstance(obj, np.datetime64):
            return str(obj)
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
    fm = current_app.fm
    # return jsonify(fm.index.to_list())
    return jsonify([5856, 10007])


@api.route('/record_filterrange', methods=['GET'])
def get_record_filterrange():
    info = {'name': 'filter_range'}
    fm = current_app.fm

    for i, filter_name in enumerate(filter_variables):
        # categorical
        if filter_name == 'GENDER':
            info[filter_name] = ['F', 'M']
        elif filter_name == 'Age':
            info[filter_name] = ['< 1 month', '< 1 year', '1-3 years', '> 3 years']
            all_records = list(set(fm[filter_name]))
            info['age'] = [min(all_records), max(all_records)]
        elif filter_name == 'SURGERY_NAME':
            all_records = []
            for surgeryname in fm[filter_name]:
                all_records = all_records + surgeryname
            info[filter_name] = list(set(all_records))
        elif fm[filter_name].dtype == object:
            all_records = list(set(fm[filter_name]))
            all_records.sort()
            info[filter_name] = all_records
        else:
            all_records = list(set(fm[filter_name]))
            info[filter_name] = [min(all_records), max(all_records)]
    return jsonify(info)


@api.route('/patient_group', methods=['GET'])
def get_patient_group():
    conditions = json.loads(request.args.get('filterConditions'))
    setSubjectIdG = request.args.get('setSubjectIdG')

    table_names = ['PATIENTS', 'SURGERY_INFO', 'ADMISSIONS']
    number_variables = ['Height', 'Weight', 'Surgical time (minutes)']

    es = current_app.es
    fm = current_app.fm
    subject_idG = fm.index.to_list()

    info = {'subject_idG': subject_idG}

    # filter subject_idG according to the conditions
    for i, table_name in enumerate(table_names):
        df = es[table_name].df
        df = df[df['SUBJECT_ID'].isin(subject_idG)]
        for item, value in conditions.items():
            if item in df.columns:
                if item in number_variables:
                    df = df[(df[item] >= value[0]) & (df[item] <= value[1])]
                elif item == 'Age':
                    filter_flag = False
                    if '< 1 month' in value:
                        filter_flag = filter_flag | (df[item] <= 1)
                    if '1-3 years' in value:
                        filter_flag = filter_flag | (
                                df[item] >= 12) & (df[item] <= 36)
                    if '< 1 year' in value:
                        filter_flag = filter_flag | (
                                df[item] >= 1) & (df[item] <= 12)
                    if '> 3 years' in value:
                        filter_flag = filter_flag | (df[item] >= 36)
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
                    raise UserWarning(
                        "Condition: {} will not be considered.".format(item))

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


@api.route('/table_names', methods=['GET'])
def get_table_names():
    table_names = ['LABEVENTS', 'SURGERY_VITAL_SIGNS', 'CHARTEVENTS']
    return jsonify(table_names)


@api.route('/prediction_target', methods=['GET'])
def get_prediction_target():
    return jsonify(Modeler.prediction_targets())


@api.route('/prediction', methods=['GET'])
def get_prediction():
    subject_id = int(request.args.get('subject_id'))
    predictions = current_app.model_manager.predict_proba(subject_id)
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
    shap_values = current_app.model_manager.explain(
        id=subject_id, target=target)
    return jsonify(shap_values.loc[0].to_dict())


@api.route('/what_if_shap_values', methods=['GET'])
def get_what_if_shap_values():
    subject_id = int(request.args.get('subject_id'))
    target = request.args.get('target')
    shap_values = {}
    fm = current_app.fm
    if current_app.subject_idG is not None:
        fm = fm.loc[current_app.subject_idG]
        fm = fm[fm['complication'] == 0]
    model_manager = current_app.model_manager
    targets = Modeler.prediction_targets()
    stat = fm.agg(['mean', 'count', 'std']).T
    stat['low'] = stat['mean'] - stat['std'] * 1.96
    stat['high'] = stat['mean'] + stat['std'] * 1.96

    target_fv = current_app.fm.loc[subject_id]

    # What-if analysis on out-of-distribution high values
    high_features = target_fv[target_fv > stat['high']].index
    high_features = [f for f in high_features if f not in targets]
    if len(high_features) > 0:
        high_fm = pd.DataFrame(
            target_fv.values.repeat(
                len(high_features)).reshape(-1, len(high_features)),
            columns=high_features, index=fm.columns)
        for feature in high_features:
            high_fm.loc[feature, feature] = stat.loc[feature]['high']
        explanations = model_manager.explain(X=high_fm.T, target=target)
        predictions = model_manager.predict_proba(X=high_fm.T)[target]
        for i, feature in enumerate(high_features):
            shap_values[feature] = {'shap': explanations.loc[i, feature],
                                    'prediction': predictions[i]}

    # What-if analysis on out-of-distribution low values
    low_features = target_fv[target_fv < stat['low']].index
    low_features = [f for f in low_features if f not in targets]
    if len(low_features) > 0:
        low_fm = pd.DataFrame(
            target_fv.values.repeat(
                len(low_features)).reshape(-1, len(low_features)),
            columns=low_features, index=fm.columns)
        for feature in low_features:
            low_fm.loc[feature, feature] = stat.loc[feature]['low']
        explanations = model_manager.explain(X=low_fm.T, target=target)
        predictions = model_manager.predict_proba(X=low_fm.T)[target]
        for i, feature in enumerate(low_features):
            shap_values[feature] = {'shap': explanations.loc[i, feature],
                                    'prediction': predictions[i]}

    return jsonify(shap_values)


@api.route('/reference_value', methods=['GET'])
def get_reference_value():
    table_name = request.args.get('table_name')
    column_name = request.args.get('column_name')
    table_info = META_INFO[table_name]
    references = {}
    df = current_app.es[table_name].df
    filter_df = df[df['SUBJECT_ID'].isin(current_app.subject_idG)]
    for group in filter_df.groupby(table_info.get('item_index')):
        item_name = group[0]
        mean, count, std = group[1][column_name].agg(['mean', 'count', 'std'])
        references[item_name] = {
            'mean': 0 if np.isnan(mean) else mean,
            'std': 0 if np.isnan(std) else std,
            'count': 0 if np.isnan(count) else count,
            'ci95': [0 if np.isnan(mean - 1.96 * std) else (mean - 1.96 * std),
                     0 if np.isnan(mean + 1.96 * std) else (mean + 1.96 * std)]
        }
    return jsonify(references)


@api.route('/explain_signal', methods=['GET'])
def get_explain_signal():
    subject_id = int(request.args.get('subject_id'))
    item_id = request.args.get('item_id')
    fm = current_app.fm
    if current_app.subject_idG is not None:
        reference_fm = fm.loc[current_app.subject_idG]
        reference_fm = reference_fm[reference_fm['complication'] == 0]
    else:
        reference_fm = fm
    important_segs = []
    for primitive in ['mean', 'std', 'trend']:
        if primitive.lower() == 'mean':
            primitive_fn = ft.primitives.Mean()
            feature_name = "in-surgery#MEAN(SURGERY_VITAL_SIGNS.VALUE WHERE ITEMID = %s)" % (
                item_id)
        elif primitive.lower() == 'std':
            primitive_fn = ft.primitives.Std()
            feature_name = "in-surgery#STD(SURGERY_VITAL_SIGNS.VALUE WHERE ITEMID = %s)" % (
                item_id)
        elif primitive.lower() == 'trend':
            primitive_fn = ft.primitives.Trend()
            feature_name = "in-surgery#TREND(SURGERY_VITAL_SIGNS.VALUE, MONITOR_TIME WHERE " \
                           "ITEMID = %s)" % item_id
        else:
            raise ValueError("Unsupported feature name")
        mean, std = reference_fm[feature_name].agg(['mean', 'std'])
        target_value = fm.loc[subject_id, feature_name]
        important_segs.append({
            'featureName': feature_name,
            'segments': current_app.ex.occlusion_explain(item_id, "SURGERY_VITAL_SIGNS",
                                                         primitive_fn, subject_id,
                                                         lower_threshold=True,
                                                         flip=target_value < mean)})

    return jsonify(important_segs)

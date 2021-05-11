import json
import logging

import numpy as np
from flask import current_app, jsonify
from flask_restful import Resource, reqparse

LOGGER = logging.getLogger(__name__)


# TODO: generalize the filtering function
def get_patient_group(es, fm, filters):
    table_names = ['PATIENTS', 'SURGERY_INFO', 'ADMISSIONS']
    number_variables = ['Height', 'Weight', 'Surgical time (minutes)']

    subject_idG = fm.index.to_list()

    # filter subject_idG according to the conditions
    for i, table_name in enumerate(table_names):
        df = es[table_name].df
        df = df[df['SUBJECT_ID'].isin(subject_idG)]
        for item, value in filters.items():
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
    info = {'labelCounts': [np.sum(fm['lung complication']),
                            np.sum(fm['cardiac complication']),
                            np.sum(fm['arrhythmia complication']),
                            np.sum(fm['infectious complication']),
                            np.sum(fm['other complication']),
                            len(subject_idG) - np.sum(fm['complication'])],
            'ids': subject_idG}

    current_app.subject_idG = subject_idG
    return jsonify(info)


def get_available_ids():
    # return jsonify(fm.index.to_list())
    return jsonify([5856, 10007])


class SubjectIDs(Resource):
    def get(self):
        """
        Get the available patient IDs.
        ---
        tags:
          - cohort
        responses:
          200:
            description: The available IDs.
            content:
              application/json:
                schema:
                  type: array
                  items:
                    type: string
          400:
            $ref: '#/components/responses/ErrorMessage'
          500:
            $ref: '#/components/responses/ErrorMessage'
        """
        try:
            res = get_available_ids()
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res


class PatientSelection(Resource):
    def __init__(self):
        self.es = current_app.es
        self.fm = current_app.fm

        parser_get = reqparse.RequestParser(bundle_errors=True)
        parser_get.add_argument('filters', type=str, required=True, location='args')
        self.parser_get = parser_get

    def get(self):
        """
        """
        try:
            args = self.parser_get.parse_args()
            filters = json.loads(args['filters'])
        except Exception as e:
            LOGGER.exception(str(e))
            return {'message', str(e)}, 400

        try:
            res = get_patient_group(self.es, self.fm, filters)
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res

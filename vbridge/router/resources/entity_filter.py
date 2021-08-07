import json
import logging

import numpy as np
from flask import current_app
from flask_restful import Resource, reqparse

from vbridge.data_loader.pic_schema import filter_variables

LOGGER = logging.getLogger(__name__)


def get_static_ranges(es):
    ranges = []
    for var in filter_variables:
        df = es[var['entityId']].df
        records = df[var['columnId']].tolist()
        if var['type'] == 'Numerical':
            extent = [min(records), max(records)]
        elif var['type'] == 'Categorical':
            extent = sorted(set(records))
        elif var['type'] == 'Multi-hot':
            split_records = []
            for record in records:
                split_records += record.split('+')
            extent = sorted(set(split_records))
        else:
            raise ValueError("Unsupported variable type.")
        var['extent'] = extent
        ranges.append(var)
    return ranges


def get_patient_groups(es, filters):
    subjectIds = es['PATIENTS'].df.index.tolist()
    for var in filters:
        df = es[var['entityId']].df
        df = df[df['SUBJECT_ID'].isin(subjectIds)]
        col = var['attributeId']
        extent = var['extent']
        if var['type'] == 'Numerical':
            df = df[df[col] >= extent[0] & df[col] <= extent[1]]
        elif var['type'] == 'Categorical':
            df = df[df[col].isin(extent)]
        elif var['type'] == 'Multi-hot':
            df = df[df.apply(lambda x: np.array([t in x[col] for t in extent]).all(),
                             axis='columns')]
        else:
            raise ValueError("Unsupported variable type.")
        subjectIds = df['SUBJECT_ID'].drop_duplicates().values.tolist()
    return subjectIds


class ColumnExtents(Resource):

    def get(self):
        """
        Get the default range of the static attributes (e.g., age).
        ---
        tags:
          - entity set
        responses:
          200:
            description: The default range of the static attributes (e.g., age).
            content:
              application/json:
                schema:
                  type: array
                  items:
                    $ref: '#/components/schemas/ColumnExtent'
          500:
            $ref: '#/components/responses/ErrorMessage'
        """
        try:
            settings = current_app.settings
            res = get_static_ranges(settings['entityset'])
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res


class PatientSelection(Resource):
    def __init__(self):
        parser_get = reqparse.RequestParser(bundle_errors=True)
        parser_get.add_argument('filters', type=str, location='args')
        self.parser_get = parser_get

    def put(self):
        """
        Update the selected subject ids.
        ---
        tags:
          - entity set
        parameters:
          - name: filters
            in: query
            required: true
            schema:
              type: string
        responses:
          200:
            description: The selected subject ids.
            content:
              application/json:
                schema:
                  type: array
                  items:
                    type: string
        """
        try:
            args = self.parser_get.parse_args()
            filters = json.loads(args.get('filters', '[]'))
        except Exception as e:
            LOGGER.exception(str(e))
            return {'message', str(e)}, 400

        try:
            settings = current_app.settings
            res = get_patient_groups(settings['entityset'], filters)
            current_app.settings['selected_ids'] = res
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res

import logging

import numpy as np
from flask import current_app, jsonify
from flask_restful import Resource, reqparse

from vbridge.data_loader.settings import META_INFO

LOGGER = logging.getLogger(__name__)


def get_reference_value(es, table_name, column_name):
    table_info = META_INFO[table_name]
    df = es[table_name].df
    df = df[df['SUBJECT_ID'].isin(current_app.subject_idG)]
    references = {}
    for group in df.groupby(table_info.get('item_index')):
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


class ReferenceValue(Resource):
    def __init__(self):
        self.es = current_app.es

        parser_get = reqparse.RequestParser(bundle_errors=True)
        parser_get.add_argument('table_name', type=str, required=True, location='args')
        parser_get.add_argument('column_name', type=str, required=True, location='args')
        self.parser_get = parser_get

    def get(self):
        """
        Get the reference value of the target attributes.
        ---
        tags:
          - entity set
        parameters:
          - name: table_name
            in: query
            schema:
              type: string
            required: true
            description: ID of the table.
          - name: column_name
            in: query
            schema:
              type: string
            required: true
            description: ID of the column.
        responses:
          200:
            description: The reference value of the target attributes.
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/ReferenceRange'
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

        table_name = args['table_name']
        column_name = args['column_name']
        try:
            res = get_reference_value(self.es, table_name, column_name)
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res

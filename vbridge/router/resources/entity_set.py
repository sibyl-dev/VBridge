import json
import logging

import numpy as np
from flask import current_app
from flask_restful import Resource, reqparse

from vbridge.data_loader.settings import META_INFO, filter_variables

LOGGER = logging.getLogger(__name__)


def get_item_dict(es, entity_id):
    item_dict = {}
    if entity_id == 'LABEVENTS':
        item_dict = es['D_LABITEMS'].df.loc[:, ['LABEL', 'LABEL_CN']].to_dict('index')
    elif entity_id in ['CHARTEVENTS', 'LABEVENTS', 'SURGERY_VITAL_SIGNS']:
        df = es['D_ITEMS'].df
        items = df[df['LINKSTO'] == entity_id.lower()].loc[:, ['LABEL', 'LABEL_CN']]
        item_dict = items.to_dict('index')
    return item_dict


def get_entity_schema(es, entity_id):
    info = {'id': entity_id}
    if entity_id in META_INFO:
        table_info = META_INFO[entity_id]
        info['time_index'] = table_info.get('time_index')
        info['item_index'] = table_info.get('item_index')
        info['value_indexes'] = table_info.get('value_indexes')
        info['alias'] = table_info.get('alias')
        info['item_dict'] = get_item_dict(es, entity_id)
        column_names = es[entity_id].df.columns
        df = es[entity_id].df
        # distinguish "categorical" and "numerical" columns
        info['types'] = ['categorical' if df[name].dtype == object
                         else 'numerical' for name in column_names]
        for i, col in enumerate(column_names):
            if col == table_info.get("time_index") or col in table_info.get("secondary_index", []):
                info['types'][i] = 'timestamp'
    return info


def get_entity_set_schema(es):
    entity_ids = ['LABEVENTS', 'SURGERY_VITAL_SIGNS', 'CHARTEVENTS']
    schema = [get_entity_schema(es, entity_id) for entity_id in entity_ids]
    return schema


def get_static_ranges(es):
    ranges = []
    for var in filter_variables:
        df = es[var['entityId']].df
        records = df[var['attributeId']].tolist()
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


def get_reference_values(es, entity_id, subject_ids):
    entity_info = META_INFO[entity_id]
    df = es[entity_id].df
    df = df[df['SUBJECT_ID'].isin(subject_ids)]
    references = {}
    columns = entity_info.get('value_indexes', [])
    for group in df.groupby(entity_info.get('item_index')):
        item_name = group[0]
        item_references = {}
        for col in columns:
            mean, count, std = group[1][col].agg(['mean', 'count', 'std'])
            item_references[col] = {
                'mean': 0 if np.isnan(mean) else mean,
                'std': 0 if np.isnan(std) else std,
                'count': 0 if np.isnan(count) else count,
                'ci95': [0 if np.isnan(mean - 1.96 * std) else (mean - 1.96 * std),
                         0 if np.isnan(mean + 1.96 * std) else (mean + 1.96 * std)]
            }
            references[item_name] = item_references
    return references


def get_all_reference_values(es):
    entity_ids = [entity['id'] for entity in get_entity_set_schema(es)]
    return {id: get_reference_values(es, id) for id in entity_ids}


class EntitySchema(Resource):
    def get(self, entity_id):
        """
        Get the schema of the entity.
        ---
        tags:
          - entity set
        parameters:
          - name: entity_id
            in: path
            schema:
              type: string
            required: true
            description: ID of the entity.
        responses:
          200:
            description: The schema of the entity.
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/EntitySchema'
          500:
            $ref: '#/components/responses/ErrorMessage'
        """
        try:
            res = get_entity_schema(current_app.es, entity_id)
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res


class EntitySetSchema(Resource):

    def get(self):
        """
        Get the schema of the entity.
        ---
        tags:
          - entity set
        responses:
          200:
            description: The schema of the entity.
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/EntitySetSchema'
          500:
            $ref: '#/components/responses/ErrorMessage'
        """
        try:
            res = get_entity_set_schema(current_app.es)
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res


class StaticRecordRange(Resource):

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
                  $ref: '#/components/schemas/DefaultRange'
          500:
            $ref: '#/components/responses/ErrorMessage'
        """
        try:
            res = get_static_ranges(current_app.es)
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
            res = get_patient_groups(current_app.es, filters)
            current_app.selected_subject_ids = res
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res


class ReferenceValues(Resource):

    def get(self, entity_id):
        """
        Get the reference value of the target attributes.
        ---
        tags:
          - entity set
        parameters:
          - name: entity_id
            in: path
            schema:
              type: string
            required: true
            description: ID of the entity.
        responses:
          200:
            description: The reference value of the target attributes.
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/ReferenceValues'
          400:
            $ref: '#/components/responses/ErrorMessage'
          500:
            $ref: '#/components/responses/ErrorMessage'
        """
        try:
            res = get_reference_values(current_app.es, entity_id, current_app.selected_subject_ids)
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res


class AllReferenceValues(Resource):

    def get(self):
        """
        Get the reference value of the target attributes.
        ---
        tags:
          - entity set
        responses:
          200:
            description: The reference value of the target attributes.
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/ReferenceValues'
          400:
            $ref: '#/components/responses/ErrorMessage'
          500:
            $ref: '#/components/responses/ErrorMessage'
        """
        try:
            res = get_all_reference_values(current_app.es)
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res

import json
import logging

import numpy as np
from flask import current_app, jsonify
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
        df = current_app.es[entity_id].df
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


# TODO: generalize the filtering function
def get_patient_group(es, filters):
    table_names = ['PATIENTS', 'SURGERY_INFO', 'ADMISSIONS']
    number_variables = ['Height', 'Weight', 'Surgical time (minutes)']

    selected_subject_ids = es['PATIENTS'].df['SUBJECT_ID'].to_list()

    for i, table_name in enumerate(table_names):
        df = es[table_name].df
        df = df[df['SUBJECT_ID'].isin(selected_subject_ids)]
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
                    raise UserWarning("Condition: {} will not be considered.".format(item))

        selected_subject_ids = df['SUBJECT_ID'].drop_duplicates().values.tolist()

    current_app.selected_subject_ids = selected_subject_ids
    return {'ids': selected_subject_ids}


def get_record_range(fm):
    info = {}
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
            all_records = sorted(set(fm[filter_name]))
            info[filter_name] = all_records
        else:
            all_records = list(set(fm[filter_name]))
            info[filter_name] = [min(all_records), max(all_records)]
    return jsonify(info)


def get_reference_values(es, entity_id):
    entity_info = META_INFO[entity_id]
    df = es[entity_id].df
    df = df[df['SUBJECT_ID'].isin(current_app.selected_subject_ids)]
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
    def __init__(self):
        self.es = current_app.es

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
            res = get_entity_schema(self.es, entity_id)
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res


class EntitySetSchema(Resource):

    def __init__(self):
        self.es = current_app.es

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
            res = get_entity_set_schema(self.es)
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res


class StaticRecordRange(Resource):

    def __init__(self):
        self.fm = current_app.fm

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
            res = get_record_range(self.fm)
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

    def put(self):
        """
        Update the selected subject ids.
        ---
        tags:
          - entity set
        parameters:
          - name: filter
            in: query
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
            filters = json.loads(args['filters'])
        except Exception as e:
            LOGGER.exception(str(e))
            return {'message', str(e)}, 400

        try:
            res = get_patient_group(self.es, filters)
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res


class ReferenceValues(Resource):
    def __init__(self):
        self.es = current_app.es

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
            res = get_reference_values(self.es, entity_id)
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res


class AllReferenceValues(Resource):
    def __init__(self):
        self.es = current_app.es

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
            res = get_all_reference_values(self.es)
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res

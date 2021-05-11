import logging

from flask import current_app, jsonify
from flask_restful import Resource

from vbridge.data_loader.settings import META_INFO, filter_variables

LOGGER = logging.getLogger(__name__)


def get_table_names():
    table_names = ['LABEVENTS', 'SURGERY_VITAL_SIGNS', 'CHARTEVENTS']
    return jsonify(table_names)


def get_record_meta(es, table_name):
    info = {'name': table_name}
    if table_name in META_INFO:
        table_info = META_INFO[table_name]
        info['time_index'] = table_info.get('time_index')
        info['item_index'] = table_info.get('item_index')
        info['value_indexes'] = table_info.get('value_indexes')
        info['alias'] = table_info.get('alias')
        column_names = es[table_name].df.columns
        df = current_app.es[table_name].df
        # distinguish "categorical" and "numerical" columns
        info['types'] = ['categorical' if df[name].dtype == object
                         else 'numerical' for name in column_names]
        for i, col in enumerate(column_names):
            if col == table_info.get("time_index") or col in table_info.get("secondary_index", []):
                info['types'][i] = 'timestamp'

    return jsonify(info)


def get_item_dict(es):
    item_dict = {}
    for group in es['D_ITEMS'].df.groupby('LINKSTO'):
        items = group[1].loc[:, ['LABEL', 'LABEL_CN']]
        table_name = group[0].upper()
        item_dict[table_name] = items.to_dict('index')

    item_dict['LABEVENTS'] = es['D_LABITEMS'].df.loc[:, ['LABEL', 'LABEL_CN']].to_dict('index')

    return jsonify(item_dict)


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


class EntitySchema(Resource):
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
      400:
        $ref: '#/components/responses/ErrorMessage'
      500:
        $ref: '#/components/responses/ErrorMessage'
    """
    def __init__(self):
        self.es = current_app.es

    def get(self, entity_id):
        try:
            res = get_record_meta(self.es, entity_id)
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res


class EntityIDs(Resource):
    def get(self):
        """
        Get the entity IDs.
        ---
        tags:
          - entity set
        responses:
          200:
            description: The entity IDs.
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/EntityIDs'
          400:
            $ref: '#/components/responses/ErrorMessage'
          500:
            $ref: '#/components/responses/ErrorMessage'
        """
        try:
            res = get_table_names()
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res


class ItemDict(Resource):

    def __init__(self):
        self.es = current_app.es

    def get(self):
        """
        Get the map between item IDs and item names.
        ---
        tags:
          - entity set
        responses:
          200:
            description: The entity IDs.
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/ItemDict'
          400:
            $ref: '#/components/responses/ErrorMessage'
          500:
            $ref: '#/components/responses/ErrorMessage'
        """
        try:
            res = get_item_dict(self.es)
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
          400:
            $ref: '#/components/responses/ErrorMessage'
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

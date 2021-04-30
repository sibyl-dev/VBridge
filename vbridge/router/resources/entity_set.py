import logging

from flask import current_app, jsonify
from flask_restful import Resource, reqparse

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

    def __init__(self):
        self.es = current_app.es
        parser_get = reqparse.RequestParser(bundle_errors=True)
        parser_get.add_argument('table_name', type=str, required=True, location='args')
        self.parser_get = parser_get

    def get(self):
        try:
            args = self.parser_get.parse_args()
        except Exception as e:
            LOGGER.exception(str(e))
            return {'message', str(e)}, 400

        table_name = args['table_name']
        try:
            res = get_record_meta(self.es, table_name)
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res


class EntityIDs(Resource):
    def get(self):
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
        try:
            res = get_record_range(self.fm)
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res

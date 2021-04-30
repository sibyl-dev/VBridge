import logging

from flask_restful import Resource, reqparse
from flask import jsonify, current_app, Response

from vbridge.data_loader.settings import META_INFO

LOGGER = logging.getLogger(__name__)


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


class RecordMeta(Resource):

    def __init__(self):
        self.es = current_app.es
        parser_get = reqparse.RequestParser(bundle_errors=True)
        parser_get.add_argument('table_name', type=str, required=True, location='args')
        self.parser_get = parser_get

    def get(self):
        try:
            args = self.parser_get.parse_args()
            print(args)
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

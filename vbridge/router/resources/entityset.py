import logging

from flask import current_app
from flask_restful import Resource

from vbridge.data_loader.pic_schema import META_INFO
from vbridge.utils.entityset_helpers import get_item_dict

LOGGER = logging.getLogger(__name__)


def get_entity_description(es, entity_id):
    """Get the descriptions to the required entity by id.

    Args:
        es: featuretools.EntitySet, the entity set that includes all patients' health records.
        entity_id: string, the identifier of the required entity.

    Returns:
        A dict describing the required entity.
    """
    info = {'entityId': entity_id}
    item_dict = get_item_dict(es)
    if entity_id in META_INFO:
        table_info = META_INFO[entity_id]
        info['time_index'] = table_info.get('time_index')
        info['item_index'] = table_info.get('item_index')
        info['value_indexes'] = table_info.get('value_indexes')
        info['alias'] = table_info.get('alias')
        info['item_dict'] = item_dict.get(entity_id, None)
        column_names = es[entity_id].df.columns
        df = es[entity_id].df
        # distinguish "categorical" and "numerical" columns
        info['types'] = ['categorical' if df[name].dtype == object
                         else 'numerical' for name in column_names]
        for i, col in enumerate(column_names):
            if col == table_info.get("time_index") or col in table_info.get("secondary_index", []):
                info['types'][i] = 'timestamp'
    return info


def get_entity_descriptions(es, entity_ids):
    """Get the descriptions to the required entities by id.

    Args:
        es: featuretools.EntitySet, the entity set that includes all patients' health records.
        entity_ids: list, the identifiers of the required entities.

    Returns:
        A list including the descriptions of the required entities.
    """
    schema = [get_entity_description(es, entity_id) for entity_id in entity_ids]
    return schema


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
            description: Identifier of the required entity.
        responses:
          200:
            description: The schema of the required entity.
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/EntitySchema'
          500:
            $ref: '#/components/responses/ErrorMessage'
        """
        try:
            settings = current_app.settings
            res = get_entity_description(settings['entityset'], entity_id)
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res


class EntitySetSchema(Resource):

    def get(self):
        """
        Get the schema of all entities.
        ---
        tags:
          - entity set
        responses:
          200:
            description: The schema of all entities used for prediction.
            content:
              application/json:
                schema:
                  type: array
                  items:
                    $ref: '#/components/schemas/EntitySchema'
          500:
            $ref: '#/components/responses/ErrorMessage'
        """
        try:
            settings = current_app.settings
            res = get_entity_descriptions(settings['entityset'],
                                          settings['task'].backward_entities)
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res

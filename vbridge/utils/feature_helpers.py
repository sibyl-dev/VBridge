from copy import deepcopy

from vbridge.data_loader.pic_schema import META_INFO


def get_leaves(feature):
    if len(feature.base_features) > 0:
        return [f for feat in feature.base_features for f in get_leaves(feat)]
    else:
        return [feature]


def get_relevant_entity_id(feature):
    leave_nodes = get_leaves(feature)
    entity_ids = list(set([leaf.entity_id for leaf in leave_nodes]))
    if len(entity_ids) > 1:
        raise UserWarning("The system do not support features constructed with data from "
                          "multiple entities. Will choose the first entity instead.")
    return entity_ids[0]


def get_relevant_column_id(feature):
    leave_nodes = get_leaves(feature)
    entity_id = get_relevant_entity_id(feature)
    column_ids = list(set([leaf.variable.id for leaf in leave_nodes]))
    invalid_columns = list(META_INFO[entity_id].get('secondary_index', {}).keys()) \
                      + [META_INFO[entity_id].get('time_index', None)]
    column_ids = [col for col in column_ids if col not in invalid_columns]
    if len(column_ids) > 1:
        raise UserWarning("The system do not support features constructed with data from "
                          "multiple variables. Will choose the first variable instead.")
    return column_ids[0]


def get_feature_description(feature, item_dict=None):
    info = {
        'id': feature.get_name(),
        'primitive': feature.primitive.name,
        'entityId': get_relevant_entity_id(feature),
        'columnId': get_relevant_column_id(feature),
        'alias': get_relevant_column_id(feature),
    }

    if 'where' in feature.__dict__:
        filter_name = feature.where.get_name()
        info['item'] = {
            'columnId': filter_name.split(' = ')[0],
            'itemId': filter_name.split(' = ')[1],
        }
        if item_dict is not None:
            info['item']['itemAlias'] = item_dict.get(info['item']['itemId'], None)
        info['alias'] = feature.primitive.name
    return info


def group_features_by_where_item(features):
    grouped_features = deepcopy(features)
    where_item_group = {}
    for i, f in enumerate(features):
        if 'parent_id' not in f and 'item' in f:
            itemId = f['item']['itemId']
            if itemId in where_item_group:
                where_item_group[itemId]['children_ids'].append(i)
            else:
                group_node = deepcopy(f)
                group_node['id'] = itemId
                group_node['primitive'] = None
                group_node['children_ids'] = [i]
                group_node['alias'] = f['item']['itemAlias']
                grouped_features[i]['parent_id'] = len(grouped_features)
                grouped_features.append(group_node)
                where_item_group[itemId] = group_node
    return grouped_features


def group_features_by_entity(features):
    grouped_features = deepcopy(features)
    entity_group = {}
    for i, f in enumerate(features):
        if 'parent_id' in f:
            continue
        entityId = f['entityId']
        if entityId in entity_group:
            entity_group[entityId]['children_ids'].append(i)
        else:
            group_node = deepcopy(f)
            group_node['id'] = entityId
            group_node['primitive'] = None
            group_node['columnId'] = None
            group_node['item'] = None
            group_node['alias'] = entityId
            group_node['children_ids'] = [i]
            grouped_features[i]['parent_id'] = len(grouped_features)
            grouped_features.append(group_node)
            entity_group[entityId] = group_node
    return grouped_features

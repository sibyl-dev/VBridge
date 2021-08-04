import pandas as pd

from vbridge.data_loader.pic_schema import META_INFO, RELATIONSHIPS


def parse_relationship_path(relationship_path):
    # TODO: get the relationship with a public function instead
    relationship = relationship_path._relationships_with_direction[0][1]
    return {
        'parent_entity_id': relationship.parent_entity.id,
        'parent_variable_id': relationship.parent_variable.id,
        'child_entity_id': relationship.child_entity.id,
        'child_variable_id': relationship.child_variable.id,
    }


def get_forward_entities(entityset, entity_id):
    ids = []
    entity_id_pipe = [entity_id]
    while len(entity_id_pipe):
        entity_id = entity_id_pipe[0]
        entity_id_pipe = entity_id_pipe[1:]
        ids.append(entity_id)
        for child_id, _ in entityset.get_forward_entities(entity_id):
            entity_id_pipe.append(child_id)
    return ids


def is_grand_parent(entityset, parent_entity_id, child_entity_id):
    return parent_entity_id in get_forward_entities(entityset, child_entity_id)


def lowest_common_parent(entityset, entity_id1, entity_id2):
    node = None
    for p in get_forward_entities(entityset, entity_id1):
        if p != entity_id1:
            if is_grand_parent(entityset, p, entity_id2):
                node = p
                break
    return node


def find_path(entityset, source_entity, target_entity):
    """Find a path of the source entity to the target_entity."""
    nodes_pipe = [target_entity]
    parent_dict = {target_entity: None}
    while len(nodes_pipe):
        parent_node = nodes_pipe.pop()
        if parent_node == source_entity:
            break
        child_nodes = [e[0] for e in entityset.get_backward_entities(parent_node)] \
                    + [e[0] for e in entityset.get_forward_entities(parent_node)]
        for child in child_nodes:
            if child not in parent_dict:
                parent_dict[child] = parent_node
                nodes_pipe.append(child)
    node = source_entity
    paths = [[node]]
    while node != target_entity:
        node = parent_dict[node]
        paths.append(paths[-1] + [node])
    return paths


def transfer_cutoff_times(entityset, cutoff_times, source_entity, target_entity,
                          reduce="latest"):
    path = find_path(entityset, source_entity, target_entity)[-1]
    for i, source in enumerate(path[:-1]):
        target = path[i + 1]
        options = list(filter(lambda r: (r.child_entity.id == source and
                                         r.parent_entity.id == target) or
                                        (r.parent_entity.id == source and
                                         r.child_entity.id == target),
                              entityset.relationships))
        if len(options) == 0:
            raise ValueError("No Relationship between {} and {}".format(source, target))
        r = options[0]
        if target == r.child_entity.id:
            # Transfer cutoff_times to "child", e.g., PATIENTS -> ADMISSIONS
            child_df_index = r.child_entity.df[r.child_variable.id].values
            cutoff_times = cutoff_times.loc[child_df_index]
            cutoff_times.index = r.child_entity.df.index
        elif source == r.child_entity.id:
            # Transfer cutoff_times to "parent", e.g., ADMISSIONS -> PATIENTS
            cutoff_times[r.child_variable.id] = r.child_entity.df[r.child_variable.id]
            if reduce == "latest":
                idx = cutoff_times.groupby(r.child_variable.id).time.idxmax().values
            elif reduce == 'earist':
                idx = cutoff_times.groupby(r.child_variable.id).time.idxmin().values
            else:
                raise ValueError("Unknown reduce option.")
            cutoff_times = cutoff_times.loc[idx]
            cutoff_times = cutoff_times.set_index(r.child_variable.id, drop=True)

    return cutoff_times


def get_records(entityset, entity_id, subject_id, other_ids=None,
                target_entity_id=None, cutoff_times=None):
    entity = entityset[entity_id].df

    # select records by SUBJECT_ID
    if 'SUBJECT_ID' in entity.columns:
        entity_df = entity[entity['SUBJECT_ID'] == subject_id]
    else:
        entity_df = entity

    # select records by other ids, e.g., HADM_ID
    if other_ids is not None:
        for id_column, id_value in other_ids.items():
            if id_column in entity.columns:
                entity_df = entity_df[entity_df[id_column] == id_value]
            else:
                return None

    # select records before or at the cutoff_time
    time_index = META_INFO[entity_id].get('time_index')
    if time_index is not None and cutoff_times is not None and target_entity_id is not None:
        timestamp = transfer_cutoff_times(entityset, cutoff_times, target_entity_id,
                                          'PATIENTS').loc[subject_id, 'time']

        entity_df = entity_df[entity_df[time_index] <= timestamp]
    # TODO modify records according to secondary time index

    return entity_df
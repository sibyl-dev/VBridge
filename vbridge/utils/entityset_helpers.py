def remove_nan_entries(df, key_columns, verbose=True):
    n_row = len(df)
    for column in key_columns:
        df = df[df[column] == df[column]]
    if verbose:
        print("Prune ({}/{}) rows.".format(n_row - len(df), n_row))
    return df


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


def get_forward_attributes(entityset, target_entity, direct_id, interesting_ids=None):
    info = []
    entity_id_pipe = [(target_entity, direct_id)]
    while len(entity_id_pipe):
        entity_id, direct_id = entity_id_pipe.pop()
        if interesting_ids is not None and entity_id not in interesting_ids:
            continue
        df = entityset[entity_id].df
        info = [{'entityId': entity_id, 'items': df.loc[direct_id].fillna('N/A').to_dict()}] + info
        for child_id, relationship_path in entityset.get_forward_entities(entity_id):
            relation = parse_relationship_path(relationship_path)
            entity_id_pipe.append((child_id, df.loc[direct_id][relation['parent_variable_id']]))
    return info


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
        options = list(filter(lambda r: (r.child_entity.id == source
                                         and r.parent_entity.id == target)
                              or (r.parent_entity.id == source
                                  and r.child_entity.id == target),
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


def get_records(entityset, subject_id, entity_id, time_index=None, cutoff_time=None):
    entity = entityset[entity_id].df

    # select records by SUBJECT_ID
    if 'SUBJECT_ID' in entity.columns:
        entity_df = entity[entity['SUBJECT_ID'] == subject_id]
    else:
        entity_df = entity

    # select records before or at the cutoff_time
    if cutoff_time is not None and time_index is not None:
        entity_df = entity_df[entity_df[time_index] <= cutoff_time]
    # TODO filter records according to secondary time index

    return entity_df


def get_item_dict(es):
    item_dict = {'LABEVENTS': es['D_LABITEMS'].df.loc[:, 'LABEL'].to_dict()}
    for entity_id in ['CHARTEVENTS', 'SURGERY_VITAL_SIGNS']:
        df = es['D_ITEMS'].df
        # TODO: Change 'LABEL' to 'LABEL_CN' for Chinese labels
        items = df[df['LINKSTO'] == entity_id.lower()].loc[:, 'LABEL']
        item_dict[entity_id] = items.to_dict()
    return item_dict

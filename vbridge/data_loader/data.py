import os

import featuretools as ft
import pandas as pd

from vbridge.utils.directory_helpers import exist_entityset, load_entityset, save_entityset
from vbridge.utils.entityset_helpers import remove_nan_entries


def create_entityset(dataset_id, entity_configs, relationships, table_dir, load_exist=True,
                     save=True, verbose=True):
    if load_exist and exist_entityset(dataset_id):
        es = load_entityset(dataset_id)
    else:
        es = ft.EntitySet(id=dataset_id)
        # Add the entities to the entityset
        for table_name, info in entity_configs.items():
            table_df = pd.read_csv(os.path.join(table_dir, '{}.csv'.format(table_name)),
                                   date_parser=pd.to_datetime)
            if dataset_id == 'mimic-demo':
                table_df.columns = [col.upper() for col in table_df.columns]
            # Remove entries with missing identifiers
            index = info.get('index', table_df.columns[0])
            index_columns = info.get('identifiers', []) + [index]
            table_df = remove_nan_entries(table_df, index_columns, verbose=verbose)

            # ALl identifiers are set as strings
            for col in index_columns:
                table_df[col] = table_df[col].astype('str')

            es.entity_from_dataframe(entity_id=table_name,
                                     dataframe=table_df,
                                     index=index,
                                     time_index=info.get('time_index', None),
                                     secondary_time_index=info.get('secondary_index', None))

        # Add the relationships to the entityset
        for parent, primary_key, child, foreign_key in relationships:
            new_relationship = ft.Relationship(es[parent][primary_key], es[child][foreign_key])
            es = es.add_relationship(new_relationship)

        # Add interesting values for categorical columns
        for table_name, info in entity_configs.items():
            if 'interesting_values' in info:
                item_index = info['item_index']
                interesting_values = info['interesting_values']
                if interesting_values == 'ALL':
                    interesting_values = es[table_name].df[item_index].unique()
                elif isinstance(interesting_values, int):
                    interesting_values = es[table_name].df[item_index] \
                        .value_counts()[:interesting_values].index
                es[table_name][item_index].interesting_values = interesting_values

        if save:
            save_entityset(es, dataset_id)

    return es

import os

import featuretools as ft
import pandas as pd

from vbridge.data_loader.pic_schema import META_INFO, RELATIONSHIPS
from vbridge.utils import exist_entityset, load_entityset, remove_nan_entries, save_entityset

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
PIC_dir = os.path.join(ROOT, 'data/raw/PIC_mini/')


def create_entityset(name, load_exist=True, save=True, verbose=True):
    if load_exist and exist_entityset(name):
        es = load_entityset(name)
    else:
        es = ft.EntitySet(id=name)
        # Add the entities to the entityset
        for table_name, info in META_INFO.items():
            table_df = pd.read_csv(os.path.join(PIC_dir, '{}.csv'.format(table_name)),
                                   date_parser=pd.to_datetime)
            # Remove entries with missing identifiers
            index = info.get('index', table_df.columns[0])
            index_columns = info.get('identifiers', []) + [index]
            table_df = remove_nan_entries(table_df, index_columns, verbose=verbose)

            for col in index_columns:
                table_df[col] = table_df[col].astype('str')

            es.entity_from_dataframe(entity_id=table_name,
                                     dataframe=table_df,
                                     index=index,
                                     time_index=info.get('time_index', None),
                                     secondary_time_index=info.get('secondary_index', None))

        # Add the relationships to the entityset
        for parent, primary_key, child, foreign_key in RELATIONSHIPS:
            new_relationship = ft.Relationship(es[parent][primary_key], es[child][foreign_key])
            es = es.add_relationship(new_relationship)

        if save:
            save_entityset(es, name=name)

    return es

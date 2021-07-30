import os
import pathlib
import pickle

import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
output_workspace = os.path.join(ROOT, 'data/intermediate/mortality')


def save_entityset(entityset, name=''):
    output_dir = os.path.join(output_workspace, name)
    pathlib.Path(output_dir).mkdir(parents=True, exist_ok=True)
    with open(os.path.join(output_dir, 'entityset'), 'wb') as f:
        pickle.dump(entityset, f)


def load_entityset(name=''):
    output_dir = os.path.join(output_workspace, name)
    with open(os.path.join(output_dir, 'entityset'), 'rb') as f:
        return pickle.load(f)


def save_fm(df, fm_list, token='', name=''):
    output_dir = os.path.join(output_workspace, name)
    pathlib.Path(output_dir).mkdir(parents=True, exist_ok=True)
    if str(token) != '':
        token = '_' + str(token)
    with open(os.path.join(output_dir, 'fl{}.pkl'.format(token)), 'wb') as f:
        pickle.dump(fm_list, f)
    df.to_csv(os.path.join(output_dir, 'fm{}.csv'.format(token)))


def load_fm(token='', name=''):
    output_dir = os.path.join(output_workspace, name)
    if str(token) != '':
        token = '_' + str(token)
    with open(os.path.join(output_dir, 'fl{}.pkl'.format(token)), 'rb') as f:
        fm_list = pickle.load(f)
    df = pd.read_csv(os.path.join(output_dir, 'fm{}.csv'.format(token)), index_col=0)
    return df, fm_list


def exist_fm(token='', name=''):
    output_dir = os.path.join(output_workspace, name)
    if str(token) != '':
        token = '_' + str(token)
    return os.path.exists(os.path.join(output_dir, 'fl{}.pkl'.format(token))) and \
        os.path.exists(os.path.join(output_dir, 'fm{}.csv'.format(token)))


def remove_nan_entries(df, key_columns, verbose=True):
    n_row = len(df)
    for column in key_columns:
        df = df[df[column] == df[column]]
    if verbose:
        print("Prune ({}/{}) rows.".format(n_row - len(df), n_row))
    return df

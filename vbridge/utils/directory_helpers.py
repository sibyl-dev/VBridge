import os
import pathlib
import pickle

import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
output_workspace = os.path.join(ROOT, 'output')


def save_entityset(entityset, dataset_id=''):
    output_dir = os.path.join(output_workspace, dataset_id)
    pathlib.Path(output_dir).mkdir(parents=True, exist_ok=True)
    with open(os.path.join(output_dir, 'entityset.pkl'), 'wb') as f:
        pickle.dump(entityset, f)


def load_entityset(dataset_id=''):
    output_dir = os.path.join(output_workspace, dataset_id)
    with open(os.path.join(output_dir, 'entityset.pkl'), 'rb') as f:
        return pickle.load(f)


def exist_entityset(dataset_id=''):
    output_dir = os.path.join(output_workspace, dataset_id)
    return os.path.exists(os.path.join(output_dir, 'entityset.pkl'))


def save_fm(df, fm_list, dataset_id='', task_id='', token=''):
    output_dir = os.path.join(output_workspace, dataset_id, task_id)
    pathlib.Path(output_dir).mkdir(parents=True, exist_ok=True)
    if str(token) != '':
        token = '_' + str(token)
    with open(os.path.join(output_dir, 'fl{}.pkl'.format(token)), 'wb') as f:
        pickle.dump(fm_list, f)
    df.to_csv(os.path.join(output_dir, 'fm{}.csv'.format(token)))


def load_fm(dataset_id='', task_id='', token=''):
    output_dir = os.path.join(output_workspace, dataset_id, task_id)
    if str(token) != '':
        token = '_' + str(token)
    with open(os.path.join(output_dir, 'fl{}.pkl'.format(token)), 'rb') as f:
        fm_list = pickle.load(f)
    df = pd.read_csv(os.path.join(output_dir, 'fm{}.csv'.format(token)), index_col=0)
    return df, fm_list


def exist_fm(dataset_id='', task_id='', token=''):
    output_dir = os.path.join(output_workspace, dataset_id, task_id)
    if str(token) != '':
        token = '_' + str(token)
    return os.path.exists(os.path.join(output_dir, 'fl{}.pkl'.format(token))) and \
        os.path.exists(os.path.join(output_dir, 'fm{}.csv'.format(token)))


def save_selector_mat(mat, dataset_id=''):
    output_dir = os.path.join(output_workspace, dataset_id)
    pathlib.Path(output_dir).mkdir(parents=True, exist_ok=True)
    mat.to_csv(os.path.join(output_dir, 'selector_fm.csv'))


def exist_selector_mat(dataset_id=''):
    output_dir = os.path.join(output_workspace, dataset_id)
    return os.path.exists(os.path.join(output_dir, 'selector_fm.csv'))


def load_selector_mat(dataset_id=''):
    output_dir = os.path.join(output_workspace, dataset_id)
    mat = pd.read_csv(os.path.join(output_dir, 'selector_fm.csv'), index_col=0)
    return mat

import os
from datetime import timedelta

from vbridge.task.task import Task
from vbridge.utils.directory_helpers import ROOT

from ..schema import entity_configs, ignore_variables, relationships
from ..selector_variable import pic_cohort_selector

pic_dir = os.path.join(ROOT, 'data/raw/PIC')


def pic_48h_in_admission_mortality_task():
    target_entity = 'ADMISSIONS'

    def get_cutoff_times(es):
        cutoff_time = es[target_entity].df.loc[:, [es[target_entity].index,
                                                   es[target_entity].time_index]]
        cutoff_time.columns = ['instance_id', 'time']
        cutoff_time['time'] += timedelta(hours=48)
        return cutoff_time

    return Task(
        dataset_id='pic',
        table_dir=pic_dir,
        entity_configs=entity_configs,
        relationships=relationships,
        ignore_variables=ignore_variables,

        target_entity=target_entity,
        cutoff_times_fn=get_cutoff_times,
        backward_entities=['LABEVENTS', 'CHARTEVENTS'],
        forward_entities=['PATIENTS', 'ADMISSIONS'],

        task_id='in-admission mortality',
        short_desc='Whether the patient will die or survive within this admission.',
        label_fns={
            'mortality': {
                'label_values': lambda es: es['ADMISSIONS'].df['HOSPITAL_EXPIRE_FLAG'],
                'label_type': 'boolean',
                'label_extent': ['low-risk', 'high-risk']
            }
        },
        selector_fn=pic_cohort_selector
    )

from datetime import timedelta


class Task:
    def __init__(self, task_id='task', short_desc=None, target_entity=None, cutoff_times_fn=None,
                 backward_entities=None, forward_entities=None, label_fns=None):
        self._task_id = task_id
        self._short_desc = short_desc
        # For Featurization
        self._target_entity = target_entity
        self._cutoff_times_fn = cutoff_times_fn
        self._backward_entities = backward_entities
        self._forward_entities = forward_entities
        # For Modeling
        self._label_fns = label_fns

    @property
    def task_id(self):
        return self._task_id

    @property
    def short_desc(self):
        return self._short_desc

    @property
    def target_entity(self):
        return self._target_entity

    def get_cutoff_times(self, es):
        return self._cutoff_times_fn(es)

    @property
    def backward_entities(self):
        return self._backward_entities

    @property
    def forward_entities(self):
        return self._forward_entities

    def get_labels(self, es):
        return {label: fn(es) for label, fn in self._label_fns.items}


def pic_48h_in_admission_mortality_task():
    target_entity = 'ADMISSIONS'

    def get_cutoff_times(es):
        cutoff_time = es[target_entity].df.loc[:, [es[target_entity].index,
                                                   es[target_entity].time_index]]
        cutoff_time.columns = ['instance_id', 'time']
        cutoff_time['time'] += timedelta(hours=48)
        return cutoff_time

    return Task(
        task_id='48h in-admission mortality',
        short_desc='Prediction whether the patient will die or survive within this admission '
                   'according the health records from the first 48 hours of the admission',
        target_entity=target_entity,
        cutoff_times_fn=get_cutoff_times,
        backward_entities=['LABEVENTS', 'SURGERY_VITAL_SIGNS', 'CHARTEVENTS'],
        forward_entities=['PATIENTS', 'ADMISSIONS'],
        label_fns={'mortality', lambda es: es['ADMISSIONS'].df['HOSPITAL_EXPIRE_FLAG']}
    )

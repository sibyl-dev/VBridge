class Task:
    def __init__(self, dataset_id='dataset', task_id='task', short_desc=None, entity_configs=None,
                 relationships=None, table_dir=None, ignore_variables=None,
                 target_entity=None, cutoff_times_fn=None, backward_entities=None,
                 forward_entities=None, label_fns=None, selector_fn=None):
        self._dataset_id = dataset_id
        self._task_id = task_id
        self._short_desc = short_desc
        # For Entity Set
        self._table_dir = table_dir
        self._entity_configs = entity_configs
        self._relationships = relationships
        # For Featurization
        self._target_entity = target_entity
        self._cutoff_times_fn = cutoff_times_fn
        self._backward_entities = backward_entities
        self._forward_entities = forward_entities
        self._ignore_variables = ignore_variables
        # For Modeling
        self._label_fns = label_fns
        # For Cohort Selection
        self._selector_fn = selector_fn

    def __repr__(self):
        desc = "[dataset]\n"
        desc += "{:16}: {}\n".format("dataset id", self.dataset_id)
        desc += "{:16}: {}\n".format("table dir", self.table_dir)

        desc += "\n[feature]\n"
        desc += "{:16}: {}\n".format("target entity", self.target_entity)
        desc += "{:16}: {}\n".format("feature entity", ', '.join(self.forward_entities
                                                                 + self.backward_entities))

        desc += "\n[model]\n"
        desc += "{:16}: {}\n".format("task id", self.task_id)
        desc += "{:16}: {}\n".format("short desc", self.short_desc)
        desc += "{:16}\n".format("labels")
        for label, info in self._label_fns.items():
            desc += "- {:14}: {}\n".format(label, info['label_extent'])
        return desc

    @property
    def dataset_id(self):
        return self._dataset_id

    @property
    def task_id(self):
        return self._task_id

    @property
    def short_desc(self):
        return self._short_desc

    @property
    def table_dir(self):
        return self._table_dir

    @property
    def entity_configs(self):
        return self._entity_configs

    @property
    def relationships(self):
        return self._relationships

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

    @property
    def ignore_variables(self):
        return self._ignore_variables

    def get_selector_vars(self, es=None):
        return self._selector_fn(es)

    def get_labels(self, es):
        return {label: info['label_values'](es) for label, info in self._label_fns.items()}

    def get_label_desc(self):
        return {label: {k: v for k, v in info.items() if k != 'label_values'}
                for label, info in self._label_fns.items()}

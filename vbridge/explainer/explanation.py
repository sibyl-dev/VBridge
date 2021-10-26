import featuretools as ft
import numpy as np

from .anomaly import find_anomalies


# Helper functions to run occlusion algorithm
def occlude(signal, algorithm, start, size):
    # Occlude a window of a signal
    # algorithm - one of:
    #    linear - linearly connect the window endpoints
    #    mean - fill with constant equal to window mean
    #    start - fill with constant equal to first endpoint
    #    mean_endpoints - fill with constant equal to mean of endpoints

    occluded = signal.copy()
    endpoint_1 = signal[start]
    if start + size - 1 < len(signal):
        endpoint_2 = signal[start + size - 1]
    else:
        endpoint_2 = signal[len(signal) - 1]

    if algorithm == "linear":
        occluded[start:start + size] = np.linspace(endpoint_1, endpoint_2,
                                                   len(occluded[start:start + size]))
        return occluded

    if algorithm == "linear_fit":
        current_window_size = len(occluded[start:start + size])
        coeffs = np.polyfit(np.arange(current_window_size), occluded[start:start + size], 1)
        poly = np.poly1d(coeffs)
        occluded[start:start + size] = poly(np.arange(current_window_size))
        return occluded

    if algorithm == "full_linear_fit":
        coeffs = np.polyfit(np.arange(len(signal)), signal, 1)
        poly = np.poly1d(coeffs)
        occluded[start:start + size] = poly(np.arange(start, min(start + size, len(signal))))
        return occluded

    elif algorithm == "mean":
        value = signal[start:start + size].mean()

    elif algorithm == "global_mean":
        value = signal.mean()

    elif algorithm == "start":
        value = signal[start]

    elif algorithm == "mean_endpoints":
        value = (endpoint_1 + endpoint_2) / 2

    else:
        raise ValueError("Unsupported algorithm")

    occluded[start:start + size] = value
    return occluded


def feat2signal(es, feature, **kwargs):
    assert isinstance(feature, ft.IdentityFeature)
    args = feature.get_arguments()
    entity_id = args['entity_id']
    variable_id = args['variable_id']
    return extract_signal(es, entity_id, variable_id, **kwargs)


def extract_signal(es, entity_id, variable_id, filters=None,
                   time_var=None, start_time=None, end_time=None):
    df = es[entity_id].df
    if filters is not None:
        for f in filters:
            df = df[f(df)]
    if time_var is not None:
        if start_time is not None:
            df = df[df[time_var] >= start_time]
        if end_time is not None:
            df = df[df[time_var] <= end_time]
    return df[variable_id].values


def run_occlusion(es, feature, target_var, time_var=None, filters=None, start_time=None,
                  end_time=None, algorithm="full_linear_fit", window_size=5):
    # Run the occlusion algorithm on the signal
    base_features = feature.base_features

    # Extract where arguments in the features
    if filters is None:
        filters = []
    if 'where' in feature.__dict__:
        where = feature.where
        filters.append(lambda df: where.primitive(df[where.base_features[0].variable.id]))

    # Find the time and value columns of the entity
    entity_id = base_features[0].entity_id

    signal_params = {'filters': filters, 'time_var': time_var,
                     'start_time': start_time, 'end_time': end_time}

    signal_coll = [feat2signal(es, f, **signal_params) for f in base_features]
    signal_id = next(i for i, f in enumerate(base_features)
                     if f.variable.id == target_var)
    signal = feat2signal(es, base_features[signal_id], **signal_params)
    signal_lens = len(signal)

    timestamps = extract_signal(es, entity_id, time_var, **signal_params)

    base_value = feature.primitive(*signal_coll)
    v = np.zeros(signal_lens)
    hits = np.zeros(signal_lens)
    for start in range(signal_lens):
        occluded = occlude(signal, algorithm, start, window_size)
        occluded_coll = [sig if i != signal_id else occluded
                         for i, sig in enumerate(signal_coll)]
        new_value = feature.primitive(*occluded_coll)
        v[start:start + window_size] += (base_value - new_value) / np.abs(base_value)
        hits[start:start + window_size] += 1

    v = v / hits
    return signal, timestamps, v


class Explainer:
    def __init__(self, es, task, cutoff_times=None,
                 algorithm="global_mean", window_size=5):
        self._es = es
        self._task = task
        self._cutoff_times = task.get_cutoff_times(es) if cutoff_times is None else cutoff_times

        self._algorithm = algorithm
        self._window_size = window_size

    @property
    def es(self):
        return self._es

    @property
    def task(self):
        return self._task

    @property
    def cutoff_times(self):
        return self._cutoff_times

    @property
    def algorithm(self):
        return self._algorithm

    @property
    def window_size(self):
        return self._window_size

    def occlusion_explain(self, feature, direct_id, flip=False):
        # Calculate signal contributions using the occlusion algorithm
        subject_id = self.es[self.task.target_entity].df.loc[direct_id]['SUBJECT_ID']
        filters = [lambda df: df["SUBJECT_ID"] == subject_id]

        entity_id = feature.base_features[0].entity_id
        time_var = self.task.entity_configs[entity_id].get('time_index', None)
        target_var = self.task.entity_configs[entity_id].get('value_indexes', [])[0]
        signal, timestamps, v = run_occlusion(self.es, feature, target_var, time_var,
                                              filters=filters, start_time=None,
                                              end_time=self.cutoff_times.loc[direct_id, 'time'],
                                              algorithm=self.algorithm,
                                              window_size=self.window_size)
        v -= flip * 2 * v
        #     v = np.array([max(0, i) for i in v])
        anomaly_list = find_anomalies(v, range(len(v)), anomaly_padding=0).tolist()
        segments = []
        for anomaly in anomaly_list:
            # value means sum of the contributions
            start_id = int(anomaly[0])
            end_id = int(anomaly[1])
            segments.append({
                'startTime': str(timestamps[start_id]),
                'endTime': str(timestamps[end_id]),
                'contriSum': v[start_id: end_id + 1].sum(),
                'maxValue': signal[start_id: end_id + 1].max(),
                'minValue': signal[start_id: end_id + 1].min(),
            })

        return segments

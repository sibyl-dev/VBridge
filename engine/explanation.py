import pandas as pd
import featuretools as ft
import matplotlib.pyplot as plt
import numpy as np

from model import model_manager
from model.settings import META_INFO
from engine.anomaly import find_anomalies


def visualize_signal(signal, c=None, vmin=None, vmax=None):
    # Debugging functions, visualize the signal, colored by contribution
    plt.plot(np.arange(len(signal)), signal, c="black", zorder=1)
    plt.scatter(np.arange(len(signal)), signal, c=c, cmap="Reds_r", vmin=vmin, vmax=vmax,
                zorder=2)
    if c is not None:
        plt.colorbar()


def distribute_shap(shap_value, v):
    # Fairly distribute a shap value across a time series according to contribution
    if sum(v) == 0:
        print("ERROR: Sum of contributions is 0, cannot distribute value")
    v_norm = v / sum(v)
    return shap_value * v_norm


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
        occluded[start:start+size] = np.linspace(endpoint_1, endpoint_2, len(occluded[start:start+size]))
        return occluded
    
    if algorithm == "linear_fit":
        current_window_size = len(occluded[start:start+size])
        coeffs = np.polyfit(np.arange(current_window_size), occluded[start:start+size], 1)
        poly = np.poly1d(coeffs)
        occluded[start:start+size] = poly(np.arange(current_window_size))
        return occluded
    
    if algorithm == "full_linear_fit":
        coeffs = np.polyfit(np.arange(len(signal)), signal, 1)
        poly = np.poly1d(coeffs)
        occluded[start:start+size] = poly(np.arange(start, min(start+size, len(signal))))
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


def run_occlusion(signal, primitive, algorithm, window_size=5, primitive_args=None):
    # Run the occlusion algorithm on the signal

    if primitive_args is None:
        primitive_args = []
    base_value = primitive(signal, *primitive_args)
    v = np.zeros(len(signal))
    hits = np.zeros(len(signal))
    for start in range(len(signal)):
        occluded = occlude(signal, algorithm, start, window_size)
        new_value = primitive(occluded, *primitive_args)
        v[start:start + window_size] += (base_value - new_value) / np.abs(base_value)
        hits[start:start + window_size] += 1

    v = v / hits
    return v


def mean_contributions(signal):
    # Calculate the importance of each point to the mean

    mean = np.mean(signal)
    n = len(signal)
    new_means = np.array([(np.sum(signal) - x + mean) / n for x in signal])
    v = (-new_means) / (np.abs(mean))
    return v


class Explainer:
    def __init__(self, es, fm, mm):
        self._es = es
        self._fm = fm
        self._mm = mm

    @property
    def es(self):
        return self._es

    @property
    def fm(self):
        return self._fm

    @property
    def mm(self):
        return self._mm

    # HELPER FUNCTIONS FOR EXPLANATION

    def get_record_id_from_name(self, record_name, feature_table_name):
        # Get the corresponding record code from an English feature name
        feature_rows = self.es["D_ITEMS"].df.loc[self.es["D_ITEMS"].df["LABEL"] == record_name]
        record_id = \
            feature_rows.loc[feature_rows["LINKSTO"].str.lower() == feature_table_name.lower()][
                "ITEMID"][0]
        return record_id

    def extract_signal(self, subject_id, feature_table_name, record_id, start_time=None, end_time=None):
        # Extract all records for a given record type and uni oper id
        full_table = self.es[feature_table_name].df
        time_index = META_INFO[feature_table_name].get('time_index')
        item_index = META_INFO[feature_table_name].get('item_index')
        value_index = META_INFO[feature_table_name].get('value_indexes')[0]

        oper_table = full_table.loc[full_table["SUBJECT_ID"] == subject_id]
        if start_time:
            oper_table = oper_table[oper_table[time_index] >= start_time]
        if end_time:
            oper_table = oper_table[oper_table[time_index] <= end_time]

        feature_table = oper_table.loc[oper_table[item_index] == record_id]
        feature_table.sort_values(by=time_index, axis="index", inplace=True)

        feature_signal = feature_table[value_index]
        return feature_signal, feature_table

    def occlusion_explain(self, record_id, table_name, primitive, subject_id,
                          algorithm="full_linear_fit", window_size=5, start_time=None, end_time=None,
                          weight_with_shap=False, feature_name=None, return_signal=False, record_format=True,
                          lower_threshold=True, flip=False):

        # Calculate signal contributions using the occlusion algorithm
        time_index = META_INFO[table_name]['time_index']
        surgery_table = self.es['SURGERY_INFO'].df
        start_time = surgery_table[surgery_table['SUBJECT_ID'] == subject_id]['SURGERY_BEGIN_TIME'].values[0]
        end_time = surgery_table[surgery_table['SUBJECT_ID'] == subject_id]['SURGERY_END_TIME'].values[0]
        signal, signal_table = self.extract_signal(subject_id, table_name, record_id, start_time, end_time)
        signal = signal.to_numpy()

        if isinstance(primitive, ft.primitives.Mean):
            v = mean_contributions(signal)
        if isinstance(primitive, ft.primitives.Trend):
            v = run_occlusion(signal, primitive, algorithm, window_size,
                              primitive_args=[signal_table["MONITOR_TIME"].to_numpy()])
        else:
            v = run_occlusion(signal, primitive, algorithm, window_size, primitive_args=[])

        if weight_with_shap:
            feature_shap_value = self.mm.explain(id=subject_id, target='complication').loc[
                0, feature_name]
            v = distribute_shap(feature_shap_value, v).reshape(-1)
        if not record_format:
            if return_signal:
                return v, signal
            return v
        segments = []
        anomaly_list = []
        # records_to_contributions = records_to_contributions_df.to_dict(orient='records')
        index = [i for i in range(len(v))]
        time = signal_table[time_index].values
        pos_v = np.array([max(0, c) for c in v])
        neg_v = np.array([max(0, -c) for c in v])
        if flip:
            v = -v
        # anomaly_list += find_anomalies(pos_v, index, anomaly_padding=0, lower_threshold=False).tolist()
        # anomaly_list += find_anomalies(neg_v, index, anomaly_padding=0, lower_threshold=False).tolist()
        print(v)
        anomaly_list = find_anomalies(v, index, anomaly_padding=0, lower_threshold=False).tolist()
        for anomaly in anomaly_list:
            # value means sum of the contributions
            start_id = int(anomaly[0])
            end_id = int(anomaly[1])
            segments.append({
                'startTime': str(time[start_id]),
                'endTime': str(time[end_id]),
                # 'padding_start_time': 
                'contriSum': v[start_id: end_id+1].sum(),
                'maxValue': signal[start_id: end_id+1].max(),
                'minValue': signal[start_id: end_id+1].min(),
            })

        return segments

import axios, { AxiosResponse } from "axios";
import * as dataForge from "data-forge"
import * as _ from "lodash"
import { FeatureMeta } from "data/feature";
import { PatientGroup, PatientMeta } from "data/patient";
import { Entity, ItemDict } from "data/table";
import { ROOT_URL, DEV_MODE } from "./env";
import { PatientInfoMeta } from 'data/metaInfo';
import { filterType } from 'data/filterType';
import { ReferenceValueDict } from "data/common";
import { SegmentExplanation } from "data/event";


const API = `${ROOT_URL}/api`;


function checkResponse<T>(response: AxiosResponse<T>, fallback: T): T {
    if (response.status === 200) return response.data;
    console.error(`Data fetching error: ${response.status}`);
    if (DEV_MODE) {
        console.error(response);
        throw response;
    }
    return fallback;
}

export async function getPatientRecords(params: {
    table_name: string,
    subject_id: number
}): Promise<Entity<number, any>> {
    const recordUrl = `${API}/patient_records`;
    const recordResponse = await axios.get(recordUrl, { params });
    const csvResponse = checkResponse(recordResponse, []);
    const table = new Entity(dataForge.fromCSV(csvResponse));

    const metaUrl = `${API}/record_meta`;
    const metaResponse = await axios.get(metaUrl, { params });
    const metaInfo = checkResponse(metaResponse, [])
    table.setMetaInfo(metaInfo).update();

    return table;
}

export async function getTableNames(): Promise<string[]> {
    const url = `${API}/table_names`;
    const response = await axios.get(url);
    let tableNames = checkResponse(response, []);
    return tableNames;
}

export async function getPatientIds(): Promise<number[]> {
    const url = `${API}/available_ids`;
    const response = await axios.get(url);
    return checkResponse(response, [])
}

export async function getPatientFilterRange(): Promise<filterType> {
    const url = `${API}/record_filterrange`;
    const response = await axios.get(url);
    return checkResponse(response, []);
}
export async function getPatientGroup(params: {
    filterConditions: { [key: string]: any }, subject_id: number, setSubjectIdG: boolean,
}): Promise<PatientGroup> {
    const url = `${API}/patient_group`;
    const response = await axios.get(url, { params });
    return checkResponse(response, []);
}

export async function getPatientMeta(params: {
    subject_id: number
}): Promise<PatientMeta> {
    const url = `${API}/patient_meta`;
    const response = await axios.get(url, { params });
    let meta: PatientMeta = checkResponse(response, []);
    meta.SURGERY_BEGIN_TIME = new Date(meta.SURGERY_BEGIN_TIME);
    meta.SURGERY_END_TIME = new Date(meta.SURGERY_END_TIME);
    meta.ADMITTIME = new Date(meta.ADMITTIME);
    meta.DOB = new Date(meta.DOB)
    meta.days = Math.round((meta.SURGERY_BEGIN_TIME.valueOf() - meta.DOB.valueOf())/1000/60/60/24)
    return meta;
}

export async function getFeatureMate(): Promise<FeatureMeta[]> {
    const url = `${API}/feature_meta`;
    const response = await axios.get(url);
    return checkResponse(response, []);
}

export async function getPredictionTargets(): Promise<string[]> {
    const url = `${API}/prediction_target`;
    const response = await axios.get(url);
    return checkResponse(response, []);
}

export async function getPrediction(params: {
    subject_id: number
}): Promise<(target: string) => number> {
    const url = `${API}/prediction`;
    const response = await axios.get(url, { params });
    const predictions = checkResponse(response, []);
    return (target: string) => predictions[target];
}

export async function getFeatureMatrix(): Promise<dataForge.IDataFrame<number, any>> {
    const url = `${API}/feature_matrix`;
    const response = await axios.get(url);
    const checked = checkResponse(response, []);
    const fm = dataForge.fromCSV(checked, { dynamicTyping: true }).setIndex('SUBJECT_ID');
    return fm.setIndex('SUBJECT_ID');
}

export async function getFeatureValues(params: {
    subject_id: number
}): Promise<(featureName: string) => number> {
    const url = `${API}/feature_values`;
    const response = await axios.get(url, { params });
    const featureValues = checkResponse(response, []);
    return (featureName: string) => featureValues[featureName];
}

export async function getSHAPValues(params: {
    subject_id: number,
    target: string,
}): Promise<(featureName: string) => number> {
    const url = `${API}/shap_values`;
    const response = await axios.get(url, { params });
    const shapValues = checkResponse(response, []);
    return (featureName: string) => shapValues[featureName];
}

export async function getWhatIfSHAPValues(params: {
    subject_id: number,
    target: string,
}): Promise<(featureName: string) => {prediction: number, shap: number} | undefined> {
    const url = `${API}/what_if_shap_values`;
    const response = await axios.get(url, { params });
    const checked = checkResponse(response, []);
    return (featureName: string) => {
        if (_.has(checked, featureName))
            return checked[featureName]
    };
}

export async function getItemDict(): Promise<ItemDict> {
    const url = `${API}/item_dict`;
    const response = await axios.get(url);
    const checked = checkResponse(response, []);
    return (tableName: string, itemName: string) => {
        if (_.has(checked, tableName)) {
            return checked[tableName][itemName];
        }
        else return undefined;
    }
}

export async function getReferenceValues(params: {
    table_name: string,
    column_name: string,
    group_ids?: number[]
}): Promise<ReferenceValueDict> {
    const url = `${API}/reference_value`
    const response = await axios.get(url, { params });
    const checked = checkResponse(response, []);
    return (itemName: string) => {
        var res = checked

        if (_.has(res, itemName)) {
            return res[itemName];
        }
        return undefined;
    }
}

export async function getSegmentExplanation(params: {
    subject_id: number,
    item_id: number | string,
}): Promise<SegmentExplanation[]> {
    const url = `${API}/explain_signal`
    const response = await axios.get(url, { params });
    const checked = checkResponse(response, []);
    return checked;
}

import axios, { AxiosResponse } from "axios";
import * as dataForge from "data-forge"
import * as _ from "lodash"
import { FeatureMeta } from "data/feature";
import { PatientMeta } from "data/patient";
import { Entity, ItemDict } from "data/table";
import { ROOT_URL, DEV_MODE } from "./env";
import { patientInfoMeta } from 'data/metaInfo';
import { filterType } from 'data/filterType';
import { ReferenceValue } from "data/common";


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
    const recordUrl = `${API}/individual_records`;
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
    const tableNames = checkResponse(response, []);
    return tableNames;
}

export async function getPatientIds(): Promise<number[]> {
    const url = `${API}/available_ids`;
    const response = await axios.get(url);
    return checkResponse(response, [])
}

export async function getPatientInfoMeta(params: {
    subject_id: number
}): Promise<patientInfoMeta> {
    const url = `${API}/patientinfo_meta`;
    const response = await axios.get(url, { params });
    return checkResponse(response, []);
}

export async function getPatientFilterRange(): Promise<filterType> {
    const url = `${API}/record_filterrange`;
    const response = await axios.get(url);
    return checkResponse(response, []);
}
export async function getPatientGroup(params: {
    filterConditions: {[key: string]: any}, subject_id: number
}): Promise<{[key: string]: any}>{
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
    meta.SurgeryBeginTime = new Date(meta.SurgeryBeginTime);
    meta.SurgeryEndTime = new Date(meta.SurgeryEndTime);
    meta.AdmitTime = new Date(meta.AdmitTime);
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
    const fm = dataForge.fromCSV(checked);
    return fm;
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
}): Promise<(itemName: string) => (ReferenceValue|undefined)> {
    const url = `${API}/reference_value`
    const response = await axios.get(url, { params });
    const checked = checkResponse(response, []);
    return (itemName: string) => {
        // const res = JSON.parse(checked)
        var res = checked
        // if(typeof(checked) == 'string'){
        //     res = res.replace(/NaN/g, '0')
        //     console.log(res, typeof(res))
        //     res = JSON.parse(checked)
        // }
        // console.log('getReferenceValues',itemName, _.has(res, itemName))
        // console.log(res)

        if (_.has(res, itemName)){
            return res[itemName];
        }
        return undefined;
    }
}
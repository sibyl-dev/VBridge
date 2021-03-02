import axios, { AxiosResponse } from "axios";
import * as dataForge from "data-forge"
import { FeatureMeta } from "data/feature";
import { PatientMeta } from "data/patient";
import { Entity } from "data/table";
import { ROOT_URL, DEV_MODE } from "./env";

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

export async function getTableNames(): Promise<string[]>{
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

export async function getPatientMeta(params: {
    subject_id: number
}): Promise<PatientMeta>{
    const url = `${API}/patient_meta`;
    const response = await axios.get(url, { params });
    return checkResponse(response, []);
}

export async function getFeatureMate(): Promise<FeatureMeta[]>{
    const url = `${API}/feature_meta`;
    const response = await axios.get(url);
    return checkResponse(response, []);
}

export async function getPredictionTargets(): Promise<string[]>{
    const url = `${API}/prediction_target`;
    const response = await axios.get(url);
    return checkResponse(response, []);
}

export async function getPrediction(params: {
    subject_id: number
}): Promise<(target: string) => number>{
    const url = `${API}/prediction`;
    const response = await axios.get(url, { params });
    const predictions = checkResponse(response, []);
    return (target: string) => predictions[target];
}

export async function getFeatureValues(params: {
    subject_id: number
}): Promise<(featureName: string) => number>{
    const url = `${API}/feature_values`;
    const response = await axios.get(url, { params });
    const featureValues = checkResponse(response, []);
    return (featureName: string) => featureValues[featureName];
}

export async function getSHAPValues(params: {
    subject_id: number,
    target: string,
}): Promise<(featureName: string) => number>{
    const url = `${API}/shap_values`;
    const response = await axios.get(url, { params });
    const shapValues = checkResponse(response, []);
    return (featureName: string) => shapValues[featureName];
}
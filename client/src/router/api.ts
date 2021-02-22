import axios, { AxiosResponse } from "axios";
import * as dataForge from "data-forge"
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
import axios, { AxiosResponse } from "axios";
import * as d3 from "d3";
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
}): Promise<string[][]> {
    const url = `${API}/individual_records`;
    const response = await axios.get(url, { params });
    const csvResponse = checkResponse(response, []);
    const records = d3.csvParseRows(csvResponse);
    return records;
}

export async function getTableNames(): Promise<string[]>{
    const url = `${API}/table_names`;
    const response = await axios.get(url);
    const tableNames = checkResponse(response, []);
    return tableNames;
}
import axios, { AxiosRequestConfig, AxiosInstance, AxiosResponse } from "axios";
import * as dataForge from "data-forge"
import * as _ from "lodash"
import { ROOT_URL, DEV_MODE } from "./env";
import { filterType } from 'type/filterType';
import Resource from './restResource';
import {
    CfShapValues, ShapValues, SignalExplanation, FeatureSchema, FeatureSchemaResponse, FeatureValue, FeatureValueResponse,
    Entity, EntitySchema, EntitySetSchema, ReferenceValueResponse, ReferenceValues, Prediction, PatientGroup, PatientStatics,
    PatientTemporal
} from "type";


const API_URL = `${ROOT_URL}/api`;

export class RestClient {
    private server: AxiosInstance;

    // default config for http request
    private requestConfig: AxiosRequestConfig = {
        baseURL: API_URL,
    };

    // patient
    public patientStatics: Resource<PatientStatics, null>;
    public patientTemporal: Resource<PatientTemporal, null>;

    // entity set
    public entitySchemas: Resource<EntitySchema, EntitySetSchema>;
    public referenceValues: Resource<ReferenceValues, ReferenceValueResponse>;

    // feature
    public featureSchemas: Resource<FeatureSchema, FeatureSchemaResponse>;
    public featureValues: Resource<FeatureValue, FeatureValueResponse>;

    // model
    public predictions: Resource<Prediction, null>;

    // explanation
    public shapValues: Resource<ShapValues, null>;
    public cfShapValues: Resource<CfShapValues, null>;
    public signalExplanation: Resource<SignalExplanation, null>;

    /**
     *
     * @param config AxiosRequestConfig
     */
    constructor(config: AxiosRequestConfig) {
        this.requestConfig = { ...this.requestConfig, ...config };
        this.server = axios.create(this.requestConfig);

        // add resources
        this.patientStatics = new Resource(this.server, 'patient_statics/');
        this.patientTemporal = new Resource(this.server, 'patient_temporal/');

        this.entitySchemas = new Resource(this.server, 'entity_schema/');
        this.referenceValues = new Resource(this.server, 'reference_values/');

        this.featureSchemas = new Resource(this.server, 'feature_schemas/');
        this.featureValues = new Resource(this.server, 'feature_values/');

        this.predictions = new Resource(this.server, 'predictions/');

        this.shapValues = new Resource(this.server, 'shap_values/');
        this.cfShapValues = new Resource(this.server, 'counterfactual_shap_values/');
        this.signalExplanation = new Resource(this.server, 'signal_explanations/');
    }
}

export default new RestClient({
    baseURL: 'http://127.0.0.1:7777/api/',
});


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
    const recordUrl = `${API_URL}/patient_records`;
    const recordResponse = await axios.get(recordUrl, { params });
    const csvResponse = checkResponse(recordResponse, []);
    const metaUrl = `${API_URL}/record_meta`;
    const metaResponse = await axios.get(metaUrl, { params });
    const metaInfo = checkResponse(metaResponse, [])

    const table = new Entity(metaInfo, dataForge.fromCSV(csvResponse));
    return table;
}

export async function getPatientFilterRange(): Promise<filterType> {
    const url = `${API_URL}/record_filterrange`;
    const response = await axios.get(url);
    return checkResponse(response, []);
}
export async function getPatientGroup(params: {
    filters: { [key: string]: any }
}): Promise<PatientGroup> {
    const url = `${API_URL}/patient_group`;
    const response = await axios.get(url, { params });
    return checkResponse(response, []);
}

// export async function getPatientMeta(params: {
//     subject_id: number
// }): Promise<PatientStatics> {
//     const url = `${API_URL}/patient_meta`;
//     const response = await axios.get(url, { params });
//     let meta: PatientStatics = checkResponse(response, []);
//     meta.SURGERY_BEGIN_TIME = new Date(meta.SURGERY_BEGIN_TIME);
//     meta.SURGERY_END_TIME = new Date(meta.SURGERY_END_TIME);
//     meta.ADMITTIME = new Date(meta.ADMITTIME);
//     meta.DOB = new Date(meta.DOB)
//     meta.ageInDays = Math.round((meta.SURGERY_BEGIN_TIME.valueOf() - meta.DOB.valueOf()) / 1000 / 60 / 60 / 24)
//     return meta;
// }

// export async function getFeatureMate(): Promise<FeatureSchema[]> {
//     const url = `${API_URL}/feature_meta`;
//     const response = await axios.get(url);
//     return checkResponse(response, []);
// }

// export async function getPredictionTargets(): Promise<string[]> {
//     const url = `${API_URL}/prediction_target`;
//     const response = await axios.get(url);
//     return checkResponse(response, []);
// }

// export async function getPrediction(params: {
//     subject_id: number
// }): Promise<(target: string) => number> {
//     const url = `${API_URL}/prediction`;
//     const response = await axios.get(url, { params });
//     const predictions = checkResponse(response, []);
//     return (target: string) => predictions[target];
// }

// export async function getFeatureMatrix(): Promise<dataForge.IDataFrame<number, any>> {
//     const url = `${API_URL}/feature_matrix`;
//     const response = await axios.get(url);
//     const checked = checkResponse(response, []);
//     const fm = dataForge.fromCSV(checked, { dynamicTyping: true }).setIndex('SUBJECT_ID');
//     return fm.setIndex('SUBJECT_ID');
// }

// export async function getFeatureValues(params: {
//     subject_id: number
// }): Promise<(featureName: string) => number> {
//     const url = `${API_URL}/feature_values`;
//     const response = await axios.get(url, { params });
//     const featureValues = checkResponse(response, []);
//     return (featureName: string) => featureValues[featureName];
// }

// export async function getSHAPValues(params: {
//     subject_id: number,
//     target: string,
// }): Promise<(featureName: string) => number> {
//     const url = `${API_URL}/shap_values`;
//     const response = await axios.get(url, { params });
//     const shapValues = checkResponse(response, []);
//     return (featureName: string) => shapValues[featureName];
// }

// export async function getWhatIfSHAPValues(params: {
//     subject_id: number,
//     target: string,
// }): Promise<(featureName: string) => { prediction: number, shap: number } | undefined> {
//     const url = `${API_URL}/what_if_shap_values`;
//     const response = await axios.get(url, { params });
//     const checked = checkResponse(response, []);
//     return (featureName: string) => {
//         if (_.has(checked, featureName))
//             return checked[featureName]
//     };
// }

// export async function getItemDict(): Promise<ItemDict> {
//     const url = `${API_URL}/item_dict`;
//     const response = await axios.get(url);
//     const checked = checkResponse(response, []);
//     return (tableName: string, itemName: string) => {
//         if (_.has(checked, tableName)) {
//             return checked[tableName][itemName];
//         }
//         else return undefined;
//     }
// }

// export async function getReferenceValues(params: {
//     table_name: string,
//     column_name: string,
//     group_ids?: number[]
// }): Promise<ReferenceValueDict> {
//     const url = `${API_URL}/reference_value`
//     const response = await axios.get(url, { params });
//     const checked = checkResponse(response, []);
//     return (itemName: string) => {
//         var res = checked

//         if (_.has(res, itemName)) {
//             return res[itemName];
//         }
//         return undefined;
//     }
// }

// export async function getSegmentExplanation(params: {
//     subject_id: number,
//     item_id: number | string,
// }): Promise<SignalExplanation[]> {
//     const url = `${API_URL}/explain_signal`
//     const response = await axios.get(url, { params });
//     const checked = checkResponse(response, []);
//     return checked;
// }


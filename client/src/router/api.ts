import axios, { AxiosRequestConfig, AxiosInstance } from "axios";
import { ROOT_URL } from "./env";
// import { filterType } from 'type/filterType';
import Resource from './restResource';
import {
    WhatIfSHAP, SHAP, SignalExplanation, FeatureSchema, FeatureSchemaResponse, FeatureValue, FeatureValueResponse,
    EntitySchema, EntitySetSchema, ReferenceValueResponse, ReferenceValues, Prediction, PatientStatics,
    PatientTemporal, Task, Patient, PredictionResponse, SelectorVariable
} from "type/resource";


const API_URL = `${ROOT_URL}/api`;

export class RestClient {
    private server: AxiosInstance;

    // default config for http request
    private requestConfig: AxiosRequestConfig = {
        baseURL: API_URL,
    };

    // tasks
    public task: Resource<null, Task>;

    // patient
    public patient: Resource<Patient, null>;
    public patientStatics: Resource<PatientStatics, null>;
    public patientTemporal: Resource<PatientTemporal, null>;

    // entity set
    public entitySchemas: Resource<EntitySchema, EntitySetSchema>;
    public referenceValues: Resource<ReferenceValues, ReferenceValueResponse>;

    // cohort selector
    public directIds: Resource<null, string[]>;
    public cohortSelector: Resource<string[], string[]>;

    // feature
    public featureSchemas: Resource<FeatureSchema, FeatureSchemaResponse>;
    public featureValues: Resource<FeatureValue, FeatureValueResponse>;

    // prediction
    public predictions: Resource<Prediction, PredictionResponse>;

    // explanation
    public shapValues: Resource<SHAP, null>;
    public cfShapValues: Resource<WhatIfSHAP, null>;
    public signalExplanation: Resource<SignalExplanation, null>;

    /**
     *
     * @param config AxiosRequestConfig
     */
    constructor(config: AxiosRequestConfig) {
        this.requestConfig = { ...this.requestConfig, ...config };
        this.server = axios.create(this.requestConfig);

        // add resources

        // task
        this.task = new Resource(this.server, 'task/')

        // entity set
        this.entitySchemas = new Resource(this.server, 'entity_schema/');
        this.referenceValues = new Resource(this.server, 'reference_values/');

        // patient
        this.patient = new Resource(this.server, 'patient/');
        this.patientStatics = new Resource(this.server, 'patient/statics/');
        this.patientTemporal = new Resource(this.server, 'patient/temporal/');

        // cohort selector
        this.directIds = new Resource(this.server, 'direct_ids/')
        this.cohortSelector = new Resource(this.server, 'selector_extents')

        // prediction
        this.predictions = new Resource(this.server, 'prediction/');

        // feature
        this.featureSchemas = new Resource(this.server, 'feature/schema/');
        this.featureValues = new Resource(this.server, 'feature/values/');

        // explanation
        this.shapValues = new Resource(this.server, 'shap/');
        this.cfShapValues = new Resource(this.server, 'whatif_shap/');
        this.signalExplanation = new Resource(this.server, 'signal_explanations/');
    }
}

export default new RestClient({
    baseURL: 'http://127.0.0.1:7777/api/',
});

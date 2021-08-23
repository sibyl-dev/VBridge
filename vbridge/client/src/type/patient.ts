import { Entity } from "type";
import { EntitySetSchema, PandasDataFrame2DataForge, Patient, PatientStatics, Prediction } from "./resource";

export interface PatientInfo {
    id: string,
    static: PatientStatics,
    temporal: Entity<string, any>[],
    prediction: Prediction,
}

export function buildPatientInfo(id: string, patient: Patient, 
    entitySetSchema: EntitySetSchema, prediction: Prediction): PatientInfo {
    const temporal: Record<string, Entity<string, any>> = {}
    console.log(patient);
    Object.keys(patient.temporal).forEach(entityId => {
        const schema = entitySetSchema.find(es => es.id === entityId);
        const dataFrameConfig = PandasDataFrame2DataForge(patient.temporal[entityId]);
        if (schema){
            temporal.entityId = new Entity(schema, dataFrameConfig);
        }
    })
    return {
        id: id,
        static: patient.static,
        temporal: Object.keys(temporal).map(k => temporal[k]),
        prediction: prediction
    }
}
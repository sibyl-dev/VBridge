import * as dataForge from "data-forge";
import { Entity } from "type";
import { assert } from "utils/common";
import { EntitySetSchema, Patient, PatientStatics, Prediction } from "./resource";

export interface PatientInfo {
    id: string,
    static: PatientStatics,
    temporal: Entity<any, any>[],
    prediction: Prediction,
}

export function buildPatientInfo(id: string, patient: Patient, 
    entitySetSchema: EntitySetSchema, prediction: Prediction): PatientInfo {
    const temporal = Object.keys(patient.temporal).map(entityId => {
        const schema = entitySetSchema.find(es => es.entityId === entityId);
        assert(schema !== undefined);
        const df = dataForge.fromCSV(patient.temporal[entityId]);
        return new Entity(schema, df);
    });
    return {
        id: id,
        static: patient.static,
        temporal: temporal,
        prediction: prediction
    }
}
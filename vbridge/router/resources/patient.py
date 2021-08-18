import logging

from flask import current_app, jsonify
from flask_restful import Resource, reqparse

from vbridge.utils import get_forward_attributes, get_records

LOGGER = logging.getLogger(__name__)


def get_statics(es, task, direct_id):
    """Get the 'static' information from a patient.

    Args:
        es: featuretools.EntitySet, the entity set that includes all patients' health records.
        task: Task, an object describing the prediction task and other settings.
        direct_id: string, the identifier of the patient's related entry in the target entity
            (e.g., the admission id).

    Returns:
        A list, where each item describes the attributes derived from an entity. For example:

        [{"DOB": "2065-09-01 15:44:00", "GENDER": "M", "entityId": "PATIENTS"}]
    """
    records = get_forward_attributes(es, task.target_entity, direct_id, task.forward_entities)
    return records


def get_temporal(es, task, direct_id, entity_id, cutoff_times=None):
    """Get the 'temporal' information from a patient.

        Args:
            es: featuretools.EntitySet, the entity set that includes all patients' health records.
            task: Task, an object describing the prediction task and other settings.
            direct_id: string, the identifier of the patient's related entry in the target entity
                (e.g., the admission id).
            entity_id: string, the identifier of the target entity (e.g., ADMISSIONS)
            cutoff_times: pd.DataFrame, the cutoff times for the task.

        Returns:
            A dict mapping entity ids to the records in the entity. For example:

            {"CHARTEVENTS": {
                "CHARTTIME": {
                    "559792": "2065-10-17 07:21:46",
                    "561305": "2065-10-15 21:50:02",
                    ...
                }
            }}
        """
    subject_id = es[task.target_entity].df.loc[direct_id]['SUBJECT_ID']
    cutoff_time = cutoff_times.loc[direct_id, 'time']
    if entity_id is None:
        records = {entity_id: get_records(es, subject_id, entity_id,
                                          cutoff_time=cutoff_time).to_dict()
                   for entity_id in task.backward_entities}
    else:
        records = get_records(es, subject_id, entity_id, cutoff_time=cutoff_time).to_dict()
    return records


def get_patient_info(es, task, direct_id, cutoff_times=None):
    return {
        'static': get_statics(es, task, direct_id),
        'temporal': get_temporal(es, task, direct_id, None, cutoff_times)
    }


class StaticInfo(Resource):

    def get(self, direct_id):
        """
        Get a patient's static health records
        ---
        tags:
          - patient
        parameters:
          - name: direct_id
            in: path
            schema:
              type: string
            required: true
            description: the identifier of the patient's related entry in the target entity
                (e.g., the admission id).
        responses:
          200:
            description: The static information of the patient (e.g., gender).
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/PatientStatic'
          400:
            $ref: '#/components/responses/ErrorMessage'
          500:
            $ref: '#/components/responses/ErrorMessage'
        """
        try:
            settings = current_app.settings
            res = get_statics(settings['entityset'], settings['task'], direct_id)
            res = jsonify(res)
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res


class TemporalInfo(Resource):
    def __init__(self):
        parser_get = reqparse.RequestParser(bundle_errors=True)
        parser_get.add_argument('entity_id', type=str, location='args')
        self.parser_get = parser_get

    def get(self, direct_id):
        """
        Get a patient's temporal health records
        ---
        tags:
          - patient
        parameters:
          - name: direct_id
            in: path
            schema:
              type: string
            required: true
            description: the identifier of the patient's related entry in the target entity
                (e.g., the admission id).
          - name: entity_id
            in: query
            schema:
              type: string
            description:
        responses:
          200:
            description: The temporal information of the patient (e.g., lab tests).
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/PatientTemporal'
          400:
            $ref: '#/components/responses/ErrorMessage'
          500:
            $ref: '#/components/responses/ErrorMessage'
        """
        try:
            args = self.parser_get.parse_args()
            entity_id = args.get('entity_id', None)
        except Exception as e:
            LOGGER.exception(str(e))
            return {'message', str(e)}, 400

        try:
            settings = current_app.settings
            res = get_temporal(settings['entityset'], settings['task'], direct_id, entity_id,
                               settings['cutoff_time'])
            res = jsonify(res)
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res


class Info(Resource):

    def get(self, direct_id):
        """
        Get a patient's all health information
        ---
        tags:
          - patient
        parameters:
          - name: direct_id
            in: path
            schema:
              type: string
            required: true
            description: the identifier of the patient's related entry in the target entity
                (e.g., the admission id).
        responses:
          200:
            description: The dynamic information of the patient (e.g., lab tests).
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    static:
                      $ref: '#/components/schemas/PatientStatic'
                    temporal:
                      $ref: '#/components/schemas/PatientTemporal'

          400:
            $ref: '#/components/responses/ErrorMessage'
          500:
            $ref: '#/components/responses/ErrorMessage'
        """
        try:
            settings = current_app.settings
            res = get_patient_info(settings['entityset'], settings['task'], direct_id,
                                   settings['cutoff_time'])
            res = jsonify(res)
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res

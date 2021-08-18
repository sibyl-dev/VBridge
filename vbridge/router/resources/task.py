import logging

import pandas as pd
from flask import current_app
from flask_restful import Resource, reqparse

LOGGER = logging.getLogger(__name__)


def get_task(task):
    return {
        'taskId': task.task_id,
        'shortDesc': task.short_desc,
        'targetEntity': task.target_entity,
        'backwardEntities': task.backward_entities,
        'forwardEntities': task.forward_entities,
        'labels': task.get_label_desc()
    }


class Task(Resource):

    def get(self):
        """
        Get the task descriptions.
        ---
        tags:
          - explanation
        responses:
          200:
            description: The task descriptions.
            content:
              application/json:
                schema:
                  type: object
                  additionalProperties:
                    type: number
          400:
            $ref: '#/components/responses/ErrorMessage'
          500:
            $ref: '#/components/responses/ErrorMessage'
        """
        settings = current_app.settings
        try:
            res = get_task(settings['task'])
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500
        else:
            return res

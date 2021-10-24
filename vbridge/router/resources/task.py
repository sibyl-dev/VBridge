import logging

from flask import current_app
from flask_restful import Resource

LOGGER = logging.getLogger(__name__)


def get_task(task):
    return {
        'taskId': task.task_id,
        'shortDesc': task.short_desc,
        'targetEntity': task.target_entity,
        'backwardEntities': task.backward_entities,
        'forwardEntities': task.forward_entities,
        'labels': task.get_label_desc(),
        'selectorVars': task.get_selector_vars()
    }


class Task(Resource):

    def get(self):
        """
        Get the task descriptions.
        ---
        tags:
          - task
        responses:
          200:
            description: The task descriptions.
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/Task'
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

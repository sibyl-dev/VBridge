import json
import logging

from flask import current_app, jsonify
from flask_restful import Resource, reqparse

LOGGER = logging.getLogger(__name__)


class SelectorExtent(Resource):
    def __init__(self):
        parser_get = reqparse.RequestParser(bundle_errors=True)
        parser_get.add_argument('extents', type=str, location='args')
        self.parser_get = parser_get

    def put(self):
        """
        Update the selected subject ids.
        ---
        tags:
          - entity set
        parameters:
          - name: extents
            in: query
            required: true
            schema:
              type: string
        responses:
          200:
            description: The selected subject ids.
            content:
              application/json:
                schema:
                  type: array
                  items:
                    type: string
        """
        try:
            args = self.parser_get.parse_args()
            extents = json.loads(args.get('extents', '[]'))
            print(extents)
        except Exception as e:
            LOGGER.exception(str(e))
            return {'message', str(e)}, 400

        try:
            current_app.settings['selector_vars'] = extents
            current_app.settings['selector'].extents = extents
            print(current_app.settings['selector'].index.tolist())
            return jsonify(current_app.settings['selector'].index.tolist())
        except Exception as e:
            LOGGER.exception(e)
            return {'message': str(e)}, 500

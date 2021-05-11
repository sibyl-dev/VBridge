schemas = {
    'PatientStatic': {
        'type': 'object',
        'properties': {}  # todo: depending on the dataset
    },
    'PatientDynamic': {
        'type': 'object',
        'properties': {}  # todo: csv file
    },
    'FeatureMeta': {
        'type': 'object',
        'properties': {
            'name': {'type': 'string'},
            'alias': {'type': 'string'},
            'type': {'type': 'string'},
            'whereItem': {
                'type': 'array',
                'items': {
                    'type': 'string',
                },
                'maxItems': 2
            },
            'primitive': {'type': 'string'},
            'entityId': {'type': 'string'},
            'columnName': {'type': 'string'},
            'period': {'type': 'string'},
        }
    },
    'FeatureValues': {
        'type': 'object',
        'properties': {}  # todo: depending on the dataset
    },
    'EntitySchema': {
        'type': 'object',
        'properties': {
            'name': {'type': 'string'},
            'alias': {'type': 'string'},
            'time_index': {'type': 'string'},
            'item_index': {'type': 'string'},
            'value_indexes': {
                'type': 'array',
                'items': {
                    'type': 'string',
                },
            },
            'type': {'type': 'string'}  # todo: enumerate
        }
    },
    'EntityIDs': {
        'type': 'array',
        'items': {'type': 'string'}
    },
    'ItemDict': {
        'type': 'object',
        'properties': {}
    },
    'DefaultRange': {
        'type': 'object',
        'properties': {}
    },
    'ReferenceRange': {
        'type': 'object',
        'properties': {}
    },
    'Message': {
        'type': 'object',
        'properties': {
            'code': {'type': 'string', 'minimum': 100, 'maximum': 600},
            'message': {'type': 'string'}
        },
        'required': ['code', 'message']
    },
}

tags = [
    {
        'name': 'patient',
        'description': 'Everything about individual patients.'
    },
    {
        'name': 'cohort',
        'description': 'Everything about a cohort of similar patients.'
    },
    {
        'name': 'feature',
        'description': 'Everything about features.'
    },
    {
        'name': 'entity set',
        'description': 'Everything about the entity set.'
    }, {
        'name': 'model',
        'description': 'Everything about model predictions.'
    }, {
        'name': 'explanation',
        'description': 'Everything about model explanations.'
    }
]

swagger_tpl = {
    'info': {
        'description': "TODO: Add a short description",
        'title': 'VBridge RestAPI Documentation',
        'version': '0.1.0.dev'
    },
    'tags': tags,
    'components': {
        'schemas': schemas,
        'securitySchemes': {
            'tokenAuth': {
                'type': 'apiKey',
                'in': 'header',
                'name': 'Authorization',
                'description': 'Use `pineapple` as the value to test the auth.'
            },
            'uidAuth': {
                'type': 'apiKey',
                'in': 'header',
                'name': 'uid',
                'description': 'Use `pineapple` as the value to test the auth.'
            }
        },
        'responses': {
            'ErrorMessage': {
                'description': 'Error message',
                'content': {
                    'application/json': {
                        'schema': {'$ref': '#/components/schemas/Message'}
                    }
                }
            },
            'UnauthorizedError': {
                'description': ('Authentication information is missing '
                                'or invalid'),
                'content': {
                    'application/json': {
                        'schema': {'$ref': '#/components/schemas/Message'}
                    }
                }
            }
        }
    },
    'servers': [
        {
            'url': 'http://localhost:7777/',
            'description': 'Internal staging server for testing'
        }
    ]
}

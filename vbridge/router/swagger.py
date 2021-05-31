import os

schemas = {
    'PatientStatic': {
        'type': 'object',
        'properties': {
            'GENDER': {'type': 'string'},
            'SUBJECT_ID': {'type': 'string'},
            'ADMITTIME': {'type': 'string'},
            'SURGERY_BEGIN_TIME': {'type': 'string'},
            'SURGERY_END_TIME': {'type': 'string'},
        },
        'additionalProperties': {}
    },
    'FeatureSchema': {
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
    'EntitySetSchema': {
        'type': 'object',
        'properties': {
            'subject_ids': {
                'type': 'array',
                'items': {
                    'type': 'string',
                }
            },
            'entity_ids': {
                'type': 'array',
                'items': {
                    'type': 'string',
                }
            },
            'entity_schemas': {
                'type': 'array',
                'items': {
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
                }
            },
        }
    },
    'ReferenceValues': {

    },
    'SignalExplanation': {
        'type': 'array',
        'items': {
            'type': 'object',
            'properties': {
                'featureName': {'type': 'string'},
                'segments': {
                    'type': 'array',
                    'items': {
                        'type': 'object',
                        'properties': {
                            'contriSum': {'type': 'number'},
                            'maxValue': {'type': 'number'},
                            'minValue': {'type': 'number'},
                            'startTime': {'type': 'string'},
                            'endTime': {'type': 'string'}
                        }
                    }
                }
            }
        }
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
    }, {
        'name': 'feature',
        'description': 'Everything about features.'
    }, {
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

dir_path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.realpath(__file__))))

swagger_config = {
    'title': 'Sintel RestAPI Documentation',
    'uiversion': 3,
    'openapi': '3.0.2',
    'doc_dir': './apidocs/resources/',
    "headers": [
    ],
    "specs": [
        {
            "endpoint": 'apispec',
            "route": '/apispec.json',
            "rule_filter": lambda rule: True,  # all in
            "model_filter": lambda tag: True,  # all in
        }
    ],
    "swagger_ui": True,
    "static_url_path": "/flasgger_static",
    "static_folder": dir_path + "/apidocs/ui3/static",
    "template_folder": dir_path + "/apidocs/ui3/templates",
    "specs_route": "/apidocs/"
}

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

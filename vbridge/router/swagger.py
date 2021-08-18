import os

schemas = {
    'PatientStatic': {
        'type': 'array',
        'items': {
            'type': 'object',
            'required': [
                'entityId'
            ],
            'properties': {
                'entityId': {'type': 'string'},
            },
            'additionalProperties': {
                'oneOf': [
                    {'type': 'string'},
                    {'type': 'number'},
                ]
            }
        },
        'example': [{
                "DOB": "2065-09-01 15:44:00",
                "GENDER": "M",
                "entityId": "PATIENTS"
        }],
    },
    'PatientTemporal': {
        'type': 'object',
        'additionalProperties': {
            'type': 'object',
            'additionalProperties': {
                'type': 'object',
                'additionalProperties': {
                    'oneOf': [
                        {'type': 'string'},
                        {'type': 'number'},
                    ]
                }
            }
        },
        'example': {
            "CHARTEVENTS": {
                "CHARTTIME": {
                    "559792": "2065-10-17 07:21:46",
                    "561305": "2065-10-15 21:50:02",
                }
            }
        }
    },
    'ColumnExtent': {
        'type': 'object',
        'properties': {
            'entityId': {'type': 'string'},
            'columnId': {'type': 'string'},
            'extent': {
                'oneOf': [
                    {
                        'type': 'array',
                        'items': {'type': 'string'},
                    },
                    {
                        'type': 'array',
                        'items': {'type': 'number'},
                    },
                ]
            },
        }
    },
    'FeatureSchema': {
        'type': 'object',
        'properties': {
            'name': {'type': 'string'},
            'alias': {'type': 'string'},
            'type': {'type': 'string'},
            'item': {
                'type': 'object',
                'properties': {
                    'columnId': {'type': 'string'},
                    'itemId': {'type': 'string'},
                    'itemAlias': {
                        'type': 'object',
                        'properties': {
                            'LABEL': {'type': 'string'},
                            'LABEL_CN': {'type': 'string'},
                        }
                    }
                },
            },
            'primitive': {'type': 'string'},
            'entityId': {'type': 'string'},
            'columnId': {'type': 'string'},
            'period': {'type': 'string'},
        }
    },
    'EntitySchema': {
        'type': 'object',
        'properties': {
            'entityId': {'type': 'string'},
            'alias': {'type': 'string'},
            'time_index': {'type': 'string'},
            'item_index': {'type': 'string'},
            'value_indexes': {
                'type': 'array',
                'items': {
                    'type': 'string',
                },
            },
            'item_dict': {
                'type': 'object',
                'properties': {
                    'type': 'string'
                }
            },
            'types': {
                'type': 'array',
                'items': {'type': 'string'}  # todo: enumerate
            }
        }
    },
    'ReferenceValues': {
        'type': 'object',
        'additionalProperties:': {
            'type': 'object',
            'additionalProperties:': {
                'mean': {'type': 'number'},
                'std': {'type': 'number'},
                'count': {'type': 'number'},
                'ci95': {
                    'type': 'array',
                    'items': {
                        'type': 'number'
                    },
                    'maxItems': 2
                },
            }
        }
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
        'name': 'entity set',
        'description': 'Everything about the entity set.'
    }, {
        'name': 'feature',
        'description': 'Everything about features.'
    }, {
        'name': 'patient',
        'description': 'Everything about the health records on individual patients.'
    }, {
        'name': 'prediction',
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

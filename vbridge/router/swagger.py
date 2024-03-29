import os

_dataframe_schema = {
    'type': 'object',
    'properties': {
        'index': {
            'type': 'array',
            'items': {'type': 'string'}
        },
        'column': {
            'type': 'array',
            'items': {'type': 'string'}
        },
        'data': {
            'type': 'array',
            'items': {
                'type': 'object',
                'additionalProperties': {}
            }
        }
    }
}

schemas = {
    'DataFrame': _dataframe_schema,
    'Task': {
        'type': 'object',
        'properties': {
            'taskId': {'type': 'string'},
            'shortDesc': {'type': 'string'},
            'targetEntity': {'type': 'string'},
            'backwardEntities': {
                'type': 'array',
                'items': {'type': 'string'},
            },
            'forwardEntities': {
                'type': 'array',
                'items': {'type': 'string'},
            },
            'label': {
                'type': 'object',
                'additionalProperties': {
                    'type': 'object',
                    'properties': {
                        'label_type': {'type': 'string'},
                        'label_extent': {
                            'type': 'array',
                            'items': {'type': 'string'},
                        },
                    }
                }
            },
            'selectorVars': {
                'type': 'array',
                'items': {
                    'type': 'object',
                    'properties': {
                        'name': {'type': 'string'},
                        'type': {'type': 'string'},
                        'extent': {
                            'type': 'array',
                            'items': {'type': 'string'},
                        },
                    }
                }
            }
        },
        'example': {
            "taskId": "48h in-admission mortality",
            "shortDesc": "Prediction whether the patient will die or survive within this "
                         "admission according the health records from the first 48 hours of the "
                         "admission",
            "targetEntity": "ADMISSIONS",
            "backwardEntities": [
                "LABEVENTS",
                "SURGERY_VITAL_SIGNS",
                "CHARTEVENTS"
            ],
            "forwardEntities": [
                "PATIENTS",
                "ADMISSIONS"
            ],
            "labels": {
                "mortality": {
                    "label_type": "boolean",
                    "label_extent": [
                        "low-risk",
                        "high-risk"
                    ]
                }
            },
            "selectorVars": [
                {
                    "name": "Gender",
                    "type": "categorical",
                    "extent": [
                        "F",
                        "M"
                    ]
                },
                {
                    "name": "Age Range",
                    "type": "categorical",
                    "extent": [
                        "newborn (0–4 weeks)",
                        "infant (4 weeks - 1 year)",
                        "toddler (1-2 years)",
                        "preschooler or above(>2 years)"
                    ]
                }
            ]
        }
    },
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
        **_dataframe_schema,
        'example': {
            "CHARTEVENTS": {
                "columns": [
                    "SUBJECT_ID",
                    "HADM_ID",
                    "ITEMID",
                    "CHARTTIME",
                    "VALUE",
                    "VALUEUOM"
                ],
                "data": [[
                    "3718",
                    "103784",
                    "1003",
                    "2065-10-15 21:50:02",
                    160.0,
                    "bpm"
                ]],
                "index": ["9138752"]
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
            'id': {'type': 'string'},
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
        },
        'example': {
            "LABEVENTS": {
                "5002": {
                    "VALUENUM": {
                        "mean": 1.63,
                        "std": 2.20,
                        "count": 16785,
                        "ci95": [-2.68, 5.96]
                    }
                }
            }
        }
    },
    'WhatIfSHAP': {
        'type': 'object',
        'additionalProperties': {
            'type': 'object',
            'additionalProperties': {
                'type': 'object',
                'properties': {
                    'prediction': {'type': 'number'},
                    'shap': {'type': 'number'},
                }
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

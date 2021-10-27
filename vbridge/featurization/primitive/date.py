import datetime

import featuretools as ft


class Date(ft.primitives.TransformPrimitive):
    name = 'date'
    input_types = [ft.variable_types.Datetime or ft.variable_types.DatetimeTimeIndex]
    return_type = ft.variable_types.Numeric

    def __init__(self):
        super().__init__()

    def get_function(self):
        def date(column):
            if column is None:
                return None
            return column.apply(lambda row: (row.date() - datetime.date(1997, 1, 1)).days)

        return date

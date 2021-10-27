import featuretools as ft


class AgeRange(ft.primitives.TransformPrimitive):
    name = 'age_range'
    input_types = [ft.variable_types.Numeric]
    return_type = ft.variable_types.Ordinal

    def __init__(self):
        super().__init__()

    def get_function(self):
        def age_range(day):
            if day <= 4 * 7:
                return "newborn (0–4 weeks)"
            elif day <= 365:
                return "infant (4 weeks - 1 year)"
            elif day <= 365 * 2:
                return "toddler (1-2 years)"
            else:
                return "preschooler or above(>2 years)"

        def age(column):
            if column is None:
                return None
            return column.apply(age_range)

        return age

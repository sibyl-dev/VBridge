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


def pic_48h_in_admission_mortality_selector(es=None):
    selector_vars = [{
        'name': 'Gender',
        'type': 'categorical',
        'feature': None,
        'extent': ['F', 'M']
    }, {
        'name': 'Age Range',
        'type': 'categorical',
        'feature': None,
        'extent': ['newborn (0–4 weeks)',
                   'infant (4 weeks - 1 year)',
                   'toddler (1-2 years)',
                   'preschooler or above(>2 years)']
    }]
    if es is not None:
        # Build gender selector (feature)
        gender = ft.DirectFeature(ft.IdentityFeature(es["PATIENTS"]["GENDER"]), es['ADMISSIONS'])
        selector_vars[0]['feature'] = gender

        # Build age_range selector (feature): age is calculated by (Admit time - Date of Birth)
        admit_date = ft.TransformFeature(ft.IdentityFeature(es["ADMISSIONS"]["ADMITTIME"]), Date)
        both_of_date = ft.DirectFeature(
            ft.TransformFeature([ft.IdentityFeature(es["PATIENTS"]["DOB"])], Date),
            es['ADMISSIONS'])
        age_in_days = ft.TransformFeature([admit_date, both_of_date],
                                          ft.primitives.SubtractNumeric())
        age_range = ft.TransformFeature([age_in_days], AgeRange)
        selector_vars[1]['feature'] = age_range

    return selector_vars

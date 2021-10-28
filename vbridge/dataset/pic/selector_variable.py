import featuretools as ft

from vbridge.featurization.primitive.age_range import AgeRange
from vbridge.featurization.primitive.date import Date


def pic_cohort_selector(es=None):
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

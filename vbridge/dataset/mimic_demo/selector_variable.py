import featuretools as ft


def mimic_cohort_selector(es=None):
    selector_vars = [{
        'name': 'Gender',
        'type': 'categorical',
        'feature': None,
        'extent': ['F', 'M']
    }]
    if es is not None:
        # Build gender selector (feature)
        gender = ft.DirectFeature(ft.IdentityFeature(es["PATIENTS"]["GENDER"]), es['ADMISSIONS'])
        selector_vars[0]['feature'] = gender

    return selector_vars

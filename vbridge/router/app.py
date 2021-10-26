import argparse

from flask import Flask
from flask_cors import CORS

from vbridge.data_loader.data import create_entityset
from vbridge.dataset.pic.mortality.pic_task import pic_48h_in_admission_mortality_task
from vbridge.explainer.explanation import Explainer
from vbridge.featurization.feature import Featurization
from vbridge.modeling.model import ModelManager
from vbridge.patient_selector.patient_selector import PatientSelector
from vbridge.router.routes import add_routes
from vbridge.utils.router_helpers import NpEncoder


def create_app():
    app = Flask(
        __name__,
        static_url_path='',
        static_folder='../../apidocs',
        template_folder='../../apidocs'
    )

    settings = {
        'entityset': None,
        'task': None,
        'target_entity': None,
        'cutoff_time': None,
        'feature_matrix': None,
        'feature_list': None,
        'models': None,
        'selected_ids': None,
        'signal_explainer': None
    }

    # create task
    task = pic_48h_in_admission_mortality_task()
    settings['task'] = task

    # load dataset
    es = create_entityset('pic', task.entity_configs, task.relationships,
                          task.ignore_variables, verbose=False)
    settings['entityset'] = es

    settings['target_entity'] = task.target_entity
    settings['cutoff_time'] = task.get_cutoff_times(es)

    # load features
    feat = Featurization(es, task)
    fm, fl = feat.generate_features(load_exist=True)
    fm.index = fm.index.astype('str')
    settings['feature_matrix'] = fm
    settings['feature_list'] = fl

    # load model
    try:
        model_manager = ModelManager.load()
    except FileNotFoundError:
        model_manager = ModelManager(fm, es, task)
        model_manager.fit_all()
        print(model_manager.evaluate())
        model_manager.save()
    settings['models'] = model_manager

    # load similar patient group
    settings['selector_vars'] = task.get_selector_vars(es)
    selector = PatientSelector(es, settings['selector_vars'], settings['cutoff_time'])
    settings['selector'] = selector

    # load explainer
    settings["explainer"] = Explainer(es, task, settings['cutoff_time'])

    app.settings = settings
    app.json_encoder = NpEncoder
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    add_routes(app)
    return app


def start_server():
    parser = argparse.ArgumentParser()

    # Dataset, task, and model

    # API flag
    parser.add_argument('--host', default='127.0.0.1', help='The host to run the server')
    parser.add_argument('--port', default=7777, help='The port to run the server')
    parser.add_argument('--debug', action="store_true", help='Run Flask in debug mode')

    args = parser.parse_args()

    server_app = create_app()

    server_app.run(
        debug=args.debug,
        host=args.host,
        port=args.port
    )


if __name__ == '__main__':
    start_server()

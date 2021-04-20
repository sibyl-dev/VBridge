import argparse
import sys

from flask import Flask
from flask_cors import CORS

from vbridge.router.api import api
from vbridge.data_loader.data import load_pic
from vbridge.data_loader.utils import load_entityset, load_fm
from vbridge.modeling import model_manager, modeler
from vbridge.featurization import featurization
from vbridge.modeling.model_manager import ModelManager
from vbridge.featurization.featurization import generate_cutoff_times, Featurization
from vbridge.explainer.explanation import Explainer


sys.modules['model.model_manager'] = model_manager
sys.modules['model.modeler'] = modeler
sys.modules['model.featurization'] = featurization

def create_app():
    app = Flask(__name__)

    # load dataset
    try:
        es = load_entityset()
    except FileNotFoundError:
        es = load_pic(verbose=False)
    app.es = es
    app.cutoff_times = generate_cutoff_times(es)

    # load features
    try:
        fm, fl = load_fm()
    except FileNotFoundError:
        featurization = Featurization(es)
        fm, fl = featurization.generate_features()

    fm['SURGERY_NAME'] = fm['SURGERY_NAME'].apply(lambda row: row.split('+'))
    app.fm = fm
    app.fl = fl

    # load model
    try:
        model_manager = ModelManager.load()
    except FileNotFoundError:
        model_manager = ModelManager(fm)
        model_manager.fit_all()
        print(model_manager.evaluate())
    app.model_manager = model_manager
    app.subject_idG = fm.index

    # load explainer
    app.ex = Explainer(es, fm, model_manager)

    app.register_blueprint(api, url_prefix='/api')
    CORS(app, resources={r"/api/*": {"origins": "*"}})
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

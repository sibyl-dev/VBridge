import argparse

from flask import Flask
from flask_cors import CORS

from server.api import api
from model.data import load_pic
from model.utils import load_entityset, load_fm
from model.model_manager import ModelManager
from model.featurization import generate_cutoff_times, Featurization

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
        fm, fl = featurization.generate_features(forward=True, surgery_vital=True)
    app.fm = fm
    app.fl = fl

    # load model
    # try:
    #     model_manager = ModelManager.load()
    # except FileNotFoundError:
    #     model_manager = ModelManager(fm)
    #     model_manager.fit_all()
    #     print(model_manager.evaluate())
    # app.model_manager = model_manager

    # load explainer

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

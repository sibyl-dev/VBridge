import argparse

from flask import Flask
from flask_cors import CORS

from server.api import api
from model.data import load_pic
from model.utils import load_entityset
from model.featurization import generate_cutoff_times


def create_app():
    app = Flask(__name__)

    # load dataset
    try:
        es = load_entityset()
    except FileNotFoundError:
        es = load_pic(verbose=False)
    app.es = es
    app.cutoff_times = generate_cutoff_times(es)

    # load model

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

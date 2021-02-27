# Bridges

## Installation
### Development
STEP-0: Clone the repository the original source or your forks.
```
git clone https://github.com/ChengFR/DECE-research.git
```
STEP-1: Prepare for the environment.
Prepare for the python enviroment (python3.7 is recommended):
```
virtualenv venv/
source venv/bin/activate
pip install -r requirements.txt
```
Prepare for the node.js enviroment (for browser-based visualization):
```
cd client/
npm install
```
STEP-2: Add the current path to PYTHONPATH.
```
export PYTHONPATH=`pwd`:$PYTHONPATH
```

## Usage
STEP-1: Start flask development server:
```
python server/app.py --debug
```
STEP-2: Start client development server:
```
cd client/
npm start
```
STEP-3: Visit localhost:3000/ for the visualization.

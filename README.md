# OmniHealth Diagnostics - Multi-Agent Clinical Triage System

An ultra-modern, production-ready clinical decision support dashboard leveraging a unified, multi-agent machine learning pipeline. The system fuses predictions from four specialized ML sub-agents alongside a rule-based safety layer and supports clinician-in-the-loop attestation and feedback.

---

## 📐 1. System Architecture

```
                 ┌────────────────────────────────┐
                 │    Patient Triage Intake Form  │
                 └───────────────┬────────────────┘
                                 │ (Vitals, Labs, History)
                                 ▼
                 ┌────────────────────────────────┐
                 │    Rule-Based Safety Layer     │
                 └───────────────┬────────────────┘
                                 │
            ┌────────────────────┼────────────────────┬────────────────────┐
            ▼ (ML Inference)     ▼ (ML Inference)     ▼ (ML Inference)     ▼ (ML Inference)
     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
     │ Respiratory  │     │   Cardiac    │     │    Sepsis    │     │   General    │
     │  Sub-Agent   │     │  Sub-Agent   │     │  Sub-Agent   │     │  Sub-Agent   │
     └──────┬───────┘     └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
            │                    │                    │                    │
            └────────────────────┼────────────────────┴────────────────────┘
                                 ▼ (JSON Prediction Payload + SHAP)
                 ┌────────────────────────────────┐
                 │     Output Aggregator Fusion   │
                 └───────────────┬────────────────┘
                                 │
                                 ▼ (Overall Triage decision)
                 ┌────────────────────────────────┐
                 │  Clinical Telemetry Dashboard  │
                 └───────────────┬────────────────┘
                                 │
                                 ▼ (Accept / Override Action)
                 ┌────────────────────────────────┐
                 │   Attestation Feedback Log     │
                 │      (feedback_log.csv)        │
                 └────────────────────────────────┘
```

---

## 📁 2. Project Directory Structure

```
OVGU_Projects/
├── agent-training/                     # Backend Workspace & ML Models
│   ├── api_server.py                   # Production Flask API Server
│   ├── respiratory_agent_api.py        # Respiratory Agent wrapper class
│   ├── cardiac_agent_api.py            # Cardiac Agent wrapper class
│   ├── sepsis_agent_api.py             # Sepsis Agent wrapper class
│   ├── general_agent_api_xgboost.py    # General Health Agent wrapper class
│   ├── data_engineered.csv             # Raw clinical engineered training dataset
│   ├── example_patient_healthy.json    # Healthy preset patient mock profile
│   ├── example_patient_high_risk.json  # Critical preset patient mock profile
│   ├── feedback_log.csv                # Clinician-in-the-loop feedback database
│   ├── requirements.txt                # Python environment requirements
│   ├── README.md                       # This documentation file
│   └── *.joblib / *.pkl                # Trained model pipeline weights
│
└── respiratory-ui/                     # Frontend Workspace
    ├── src/
    │   ├── App.js                      # React application entry point (App.jsx clone)
    │   ├── App.css                     # Premium theme and layout styles (App.css clone)
    │   └── index.js                    # React DOM renderer
    ├── package.json                    # NPM dependencies
    └── public/                         # Public static web assets
```

---

## 🚀 3. Installation & Setup

### Prerequisites
- **Python** (v3.9 or higher)
- **Node.js** (v16 or higher) and **NPM** (v8 or higher)

### Step 1: Start the Python Backend API
1. Navigate to the backend directory:
   ```bash
   cd agent-training
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate  # Windows: .venv\Scripts\activate
   ```
3. Install the dependencies:
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```
4. Start the Flask server:
   ```bash
   python3 api_server.py
   ```
   The backend will launch at **`http://localhost:8000`**.

### Step 2: Start the React Frontend Dashboard
1. Open a new terminal window and navigate to the frontend directory:
   ```bash
   cd respiratory-ui
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Start the React development server:
   ```bash
   npm start
   ```
   The dashboard will automatically open in your browser at **`http://localhost:3000`**.

---

## 🧪 4. Model Weights & Configurations

The backend automatically loads the following trained ML architectures from the root directory on startup:
1. **Respiratory Sub-Agent** (Random Forest Classifier, 300 estimators): Loads from [respiratory_rf_pipeline.joblib](file:///Users/taneeshkpatel/Desktop/OVGU_Projects/agent-training/respiratory_rf_pipeline.joblib) and [respiratory_rf_ensemble.joblib](file:///Users/taneeshkpatel/Desktop/OVGU_Projects/agent-training/respiratory_rf_ensemble.joblib) for epistemic uncertainty.
2. **Cardiac Sub-Agent** (XGBoost Classifier, 5-class ESI mapping): Loads from [xgboost_cardiac_model.pkl](file:///Users/taneeshkpatel/Desktop/OVGU_Projects/agent-training/xgboost_cardiac_model.pkl). Mapped to ESI classes 0-4.
3. **Sepsis Sub-Agent** (XGBoost Classifier): Loads from [sepsis_xgb_model.pkl](file:///Users/taneeshkpatel/Desktop/OVGU_Projects/agent-training/sepsis_xgb_model.pkl).
4. **General Health Sub-Agent** (XGBoost Classifier): Loads from [general_xgb_model.joblib](file:///Users/taneeshkpatel/Desktop/OVGU_Projects/agent-training/general_xgb_model.joblib).

---

## 📡 5. Unified API Endpoint Reference

### 1. Health Status Check
- **Endpoint**: `GET /health`
- **Response**: Returns a JSON representation of active models and connection state.

### 2. Multi-Agent Prediction
- **Endpoint**: `POST /unified/predict`
- **Request Body (JSON)**:
  ```json
  {
    "age": 45, "sex": "M", "altered_mentation": 0, "chest_pain": 0, "diabetes": 0,
    "spo2": 97, "respiratory_rate": 16, "temperature": 36.8, "heart_rate": 70, "systolic_bp": 120, "diastolic_bp": 80,
    "wbc": 7.5, "hemoglobin": 14.0, "platelet_count": 250, "sodium": 140, "potassium": 4.0, "creatinine": 0.9, "glucose": 100, "troponin": 0.01, "bnp": 50, "lactate": 1.2, "inr": 1.0
  }
  ```
- **Response**: Contains aggregated final risk, safety alert arrays, confidence ratings, and independent sub-agent scores including SHAP values.

### 3. Clinician Triage Log Feedback
- **Endpoint**: `POST /feedback`
- **Request Body (JSON)**:
  ```json
  {
    "patient_data": { ... },
    "ai_final_risk": "HIGH",
    "clinician_override": "MEDIUM",
    "action": "override"
  }
  ```
- **Action**: Appends clinician override and patient profile metadata into `feedback_log.csv`.

---

## 👨‍⚕️ 6. Clinical Calculations

The frontend and backend automatically manage complex features:
- **Pain Score**: Dynamically calculated in real time in the frontend using a vital signs stress formula (incorporating tachycardia, hypoxia, hypo/hypertension, and temperature flags). Field is read-only.
- **Age Group**: Computed automatically in the background using numerical age to yield categoricals (`'pediatric'`, `'adult'`, `'senior'`, or `'elderly'`).
- **Feature Importance (SHAP)**: Calculated natively on inference via `pred_contribs=True` for fast local attribution.

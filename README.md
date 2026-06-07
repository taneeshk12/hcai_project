# Respiratory Agent - Multi-Agent Diagnostic System

Production-ready respiratory risk prediction agent for healthcare multi-agent systems. Predicts respiratory risk categories (Low/Medium/High) from patient vital signs and engineered features with uncertainty estimation.

## 📊 Model Performance

- **Test Accuracy**: 99.15%
- **Architecture**: RandomForest (300 trees, ensemble of 5 models)
- **Features**: 11 (7 numeric + 4 categorical after encoding)
- **Uncertainty**: Ensemble-based epistemic uncertainty estimation
- **Inference Time**: <50ms per prediction

### Performance Metrics
- **Low Risk (Class 0)**: Precision 99.6%, Recall 100%
- **Medium Risk (Class 1)**: Precision 98.1%, Recall 100%
- **High Risk (Class 2)**: Precision 100%, Recall 88.5%

## 📁 Project Structure

```
agent-training/
├── respiratory_agent_training.ipynb      # Jupyter notebook: data prep, model training, evaluation
├── respiratory_agent_api.py              # Production API module (importable)
├── data_engineered.csv                   # Training dataset (87,234 samples)
├── example_patient_healthy.json          # Test case: low-risk patient
├── example_patient_high_risk.json        # Test case: high-risk patient
├── respiratory_rf_pipeline.joblib        # Trained RandomForest + preprocessor
├── respiratory_rf_ensemble.joblib        # Ensemble (5 models) for uncertainty
├── respiratory_classifier.joblib         # Classifier component
├── respiratory_preprocessor.joblib       # Data preprocessor (scaling, encoding)
├── requirements.txt                      # Python dependencies
└── README.md                             # This file
```

## 🚀 Quick Start

### 1. Setup Environment

```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Run Training Notebook

```bash
jupyter lab respiratory_agent_training.ipynb
```

The notebook will:
- Load and preprocess data
- Create rule-based respiratory risk labels
- Train RandomForest with hyperparameter tuning
- Evaluate with 99% accuracy
- Generate SHAP explanations
- Save trained models

### 3. Use Production API

#### Option A: Import as Python Module

```python
from respiratory_agent_api import RespiratoryAgent

# Initialize agent
agent = RespiratoryAgent(verbose=True)

# Single prediction
patient = {
    'spo2': 95.0,
    'respiratory_rate': 18.0,
    'respiratory_distress_index': 0.0,
    'spo2_risk_score': 0.0,
    'rr_risk_score': 0.0,
    'temp_risk_score': 0.0,
    'temperature': 37.0,
    'heart_rate': 80.0,
    'age': 60.0,
    'sex': 'M',
    'age_group': 'senior'
}

result = agent.predict(patient)
print(f"Risk Level: {result['risk_level']}")
print(f"Confidence: {result['confidence']:.4f}")
print(f"Action: {result['clinical_action']}")
```

#### Option B: Batch Predictions

```python
patients = [patient1, patient2, patient3]  # List of patient dicts
results = agent.batch_predict(patients)
```

#### Option C: Get Model Info

```python
info = agent.get_model_info()
print(info)
```

## 📋 Expected Input Format

All predictions require the following 11 features:

| Feature | Type | Range | Unit |
|---------|------|-------|------|
| `spo2` | float | 50-100 | % |
| `respiratory_rate` | float | 0-60 | breaths/min |
| `respiratory_distress_index` | float | 0-10 | score |
| `spo2_risk_score` | float | 0-1 | normalized |
| `rr_risk_score` | float | 0-1 | normalized |
| `temp_risk_score` | float | 0-1 | normalized |
| `temperature` | float | 0-42 | °C |
| `heart_rate` | float | 0-200 | bpm |
| `age` | float | 0-120 | years |
| `sex` | string | 'M', 'F' | category |
| `age_group` | string | 'pediatric', 'adult', 'senior', 'elderly' | category |

## 📤 Expected Output Format

```python
{
    'risk_class': 0,                                    # 0=Low, 1=Medium, 2=High
    'risk_level': 'LOW',                                # Categorical label
    'probabilities': {
        'low': 0.9974,
        'medium': 0.0024,
        'high': 0.0002
    },
    'confidence': 0.9974,                               # Max probability
    'confidence_level': 'HIGH',                         # HIGH/MEDIUM/LOW
    'uncertainty': 0.001615,                            # Ensemble std (lower=more certain)
    'clinical_action': 'Low respiratory risk - continue routine monitoring',
    'top_contributing_features': ['respiratory_rate', 'respiratory_distress_index', 'spo2_risk_score'],
    'clinical_alert': False,                            # True if low confidence or high uncertainty
    'timestamp': '2026-05-26T14:30:45.123456',
    'status': 'success'
}
```

## 🏥 Clinical Risk Classification

### Rule-Based Target Labels (Used for Training)

**HIGH RISK (Class 2)** - Escalate to respiratory specialist
- `severe_alert_flag == 1` OR
- SpO₂ < 90% OR
- Respiratory Rate > 30 breaths/min OR
- Respiratory Distress Index > 4

**MEDIUM RISK (Class 1)** - Increase monitoring frequency
- SpO₂ in [90%, 94%] OR
- Respiratory Rate in [20, 30] breaths/min OR
- Respiratory Distress Index in (1, 4]

**LOW RISK (Class 0)** - Continue routine monitoring
- None of the above conditions

⚠️ **IMPORTANT**: These thresholds are for demonstration. Validate clinically before production deployment.

## 🔍 Model Architecture

### Training Pipeline

1. **Data Preprocessing**
   - Numeric features: Median imputation → StandardScaler
   - Categorical features: One-hot encoding
   - Missing values handled automatically

2. **Model**
   - Base: RandomForest (300 estimators, max_depth=20)
   - Hyperparameter tuning via RandomizedSearchCV
   - 3-fold stratified cross-validation

3. **Uncertainty Estimation**
   - Ensemble of 5 independently trained models
   - Per-sample epistemic uncertainty via ensemble variance
   - Confidence thresholds for clinical alerts

4. **Explainability**
   - SHAP TreeExplainer for sample-level explanations
   - Feature importance rankings
   - Top 3 contributing features per prediction

## 📊 Feature Importance

Top 10 most important features:
1. `respiratory_rate` - 47.8%
2. `respiratory_distress_index` - 12.8%
3. `spo2_risk_score` - 12.8%
4. `spo2` - 11.6%
5. `heart_rate` - 10.8%
6. `temperature` - 3.0%
7. `age` - 0.8%
8. Others - <1%

## 🔐 Safety & Validation

### Confidence Thresholds
- **HIGH confidence**: probability ≥ 0.85 AND uncertainty < 0.02
- **MEDIUM confidence**: probability ≥ 0.60
- **LOW confidence**: probability < 0.60 (triggers clinical alert)

### Input Validation
- All required features must be present
- Numeric ranges validated (e.g., SpO₂ 50-100%)
- Sex must be 'M' or 'F'
- Age group must be valid category

## 📚 API Methods

### `RespiratoryAgent` Class

```python
# Initialize
agent = RespiratoryAgent(
    pipeline_path='respiratory_rf_pipeline.joblib',
    ensemble_path='respiratory_rf_ensemble.joblib',
    verbose=False
)

# Single prediction
result = agent.predict(patient_dict, return_explanation=True)

# Batch predictions
results = agent.batch_predict(patients_list)

# Get model metadata
info = agent.get_model_info()

# Validate input
is_valid, error_msg = agent.validate_input(patient_dict)
```

## 🚀 Deployment Options

### Option 1: REST API (FastAPI)

```python
from fastapi import FastAPI
from respiratory_agent_api import RespiratoryAgent

app = FastAPI()
agent = RespiratoryAgent()

@app.post("/predict")
def predict(patient: dict):
    return agent.predict(patient)
```

### Option 2: Docker Container

```dockerfile
FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Option 3: Batch Processing

```python
agent = RespiratoryAgent()
with open('patients.jsonl') as f:
    patients = [json.loads(line) for line in f]
results = agent.batch_predict(patients)
```

## 📝 Requirements

See `requirements.txt` for full list. Key dependencies:
- scikit-learn >= 1.0
- pandas >= 1.3
- numpy >= 1.20
- joblib >= 1.0
- shap >= 0.41 (optional, for explanations)
- xgboost >= 1.5 (optional, for advanced features)

Install with:
```bash
pip install -r requirements.txt
```

## 🧪 Testing

Run the example predictions:

```python
from respiratory_agent_api import RespiratoryAgent
import json

agent = RespiratoryAgent(verbose=True)

with open('example_patient_healthy.json') as f:
    healthy = json.load(f)
    
with open('example_patient_high_risk.json') as f:
    high_risk = json.load(f)

print("Healthy patient:", agent.predict(healthy)['risk_level'])
print("High-risk patient:", agent.predict(high_risk)['risk_level'])
```

## 📖 Notebook Contents

The Jupyter notebook `respiratory_agent_training.ipynb` includes:

1. **Data Loading** - Load and explore engineered features
2. **Feature Engineering** - Rule-based respiratory risk target
3. **Preprocessing** - Scaling, encoding, imputation
4. **Model Training** - RandomForest with hyperparameter tuning
5. **Evaluation** - Test metrics, confusion matrix, ROC curves
6. **Uncertainty Estimation** - Ensemble-based epistemic uncertainty
7. **Explainability** - SHAP analysis and feature importance
8. **Artifact Saving** - Export trained models for production
9. **API Testing** - Example predictions with example patients
10. **Production Wrapper** - RespiratoryAgent class for deployment

## ⚠️ Clinical Validation

**Before deploying to production:**
1. ✅ Validate risk thresholds with respiratory clinicians
2. ✅ Test on diverse patient populations
3. ✅ Obtain regulatory approval (if required in your jurisdiction)
4. ✅ Implement logging and audit trails
5. ✅ Set up monitoring for model drift
6. ✅ Establish escalation procedures for uncertain predictions
7. ✅ Train clinical staff on model limitations

## 📄 License

This project is part of the OVGU multi-agent diagnostic system research.

## 👥 Contact

For questions about the respiratory agent or integration:
- Review the notebook: `respiratory_agent_training.ipynb`
- Check the API module: `respiratory_agent_api.py`
- See example patients: `example_patient_*.json`

---

**Last Updated**: May 26, 2026  
**Model Version**: 1.0  
**Status**: Production-Ready
# hcai_project

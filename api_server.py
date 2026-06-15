from flask import Flask, request, jsonify
from flask_cors import CORS
from respiratory_agent_api import RespiratoryAgent
from general_agent_api_xgboost import GeneralHealthAgent
from cardiac_agent_api import CardiacAgent
from sepsis_agent_api import SepsisAgent
import logging
from datetime import datetime
import json
import os
import csv
import numpy as np

app = Flask(__name__)
CORS(app)  # Enable React frontend to call this API

# Custom JSON encoder to handle NumPy types
class NumpyEncoder(json.JSONEncoder):
    """Custom JSON encoder that handles NumPy data types"""
    def default(self, obj):
        if isinstance(obj, (np.integer, np.int64)):
            return int(obj)
        elif isinstance(obj, (np.floating, np.float64)):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, (np.bool_, bool)):
            return bool(obj)
        return super().default(obj)

app.json_encoder = NumpyEncoder

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load agents once (on startup)
respiratory_agent = None
general_agent = None
cardiac_agent = None
sepsis_agent = None

try:
    respiratory_agent = RespiratoryAgent()
    logger.info("✓ Respiratory Agent loaded successfully")
except Exception as e:
    logger.error(f"Failed to load respiratory agent: {e}")

try:
    general_agent = GeneralHealthAgent()
    logger.info("✓ General Health Agent loaded successfully")
except Exception as e:
    logger.error(f"Failed to load general agent: {e}")

try:
    cardiac_agent = CardiacAgent()
    logger.info("✓ Cardiac Agent loaded successfully")
except Exception as e:
    logger.error(f"Failed to load cardiac agent: {e}")

try:
    sepsis_agent = SepsisAgent()
    logger.info("✓ Sepsis Agent loaded successfully")
except Exception as e:
    logger.error(f"Failed to load sepsis agent: {e}")

# ==================== RESPIRATORY ENDPOINTS ====================

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'agents': {
            'respiratory': respiratory_agent is not None,
            'general': general_agent is not None,
            'cardiac': cardiac_agent is not None,
            'sepsis': sepsis_agent is not None
        }
    }), 200

@app.route('/respiratory/predict', methods=['POST'])
def respiratory_predict():
    """
    Single respiratory patient prediction
    
    POST /respiratory/predict
    Body: {
        "spo2": 95,
        "respiratory_rate": 18,
        "temperature": 37.2,
        "heart_rate": 72,
        "age": 45,
        "sex": "M",
        "age_group": "30-50"
    }
    
    Note: Risk scores and respiratory distress index are calculated 
    automatically by the backend from raw vital signs.
    """
    try:
        if respiratory_agent is None:
            return jsonify({'error': 'Respiratory Agent not loaded'}), 503
        
        patient_data = request.get_json()
        
        # Get prediction (agent validates inputs and calculates risk scores)
        result = respiratory_agent.predict(patient_data)
        
        # Convert NumPy types to native Python types for JSON serialization
        result = json.loads(json.dumps(result, cls=NumpyEncoder))
        
        # Add timestamp
        result['timestamp'] = datetime.now().isoformat()
        result['patient_data'] = patient_data
        
        logger.info(f"Respiratory Prediction: {result['risk_level']} (conf: {result['confidence']:.2%})")
        
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"Respiratory prediction error: {e}")
        return jsonify({'error': str(e)}), 400

@app.route('/respiratory/batch', methods=['POST'])
def respiratory_batch_predict():
    """
    Multiple respiratory patients prediction
    
    POST /respiratory/batch
    Body: [
        {patient1_data},
        {patient2_data},
        ...
    ]
    """
    try:
        if respiratory_agent is None:
            return jsonify({'error': 'Respiratory Agent not loaded'}), 503
        
        patients = request.get_json()
        
        if not isinstance(patients, list):
            return jsonify({'error': 'Body must be a JSON array'}), 400
        
        results = []
        for i, patient in enumerate(patients):
            try:
                result = respiratory_agent.predict(patient)
                # Convert NumPy types to native Python types
                result = json.loads(json.dumps(result, cls=NumpyEncoder))
                result['patient_index'] = i
                result['timestamp'] = datetime.now().isoformat()
                results.append(result)
            except Exception as e:
                results.append({
                    'patient_index': i,
                    'error': str(e),
                    'status': 'error'
                })
        
        logger.info(f"Respiratory batch prediction: {len(results)} patients processed")
        
        return jsonify({
            'total': len(results),
            'predictions': results
        }), 200
        
    except Exception as e:
        logger.error(f"Respiratory batch prediction error: {e}")
        return jsonify({'error': str(e)}), 400

@app.route('/respiratory/model-info', methods=['GET'])
def respiratory_model_info():
    """Get respiratory model metadata"""
    return jsonify({
        'model_type': 'RandomForest',
        'n_estimators': 300,
        'test_accuracy': 0.9915,
        'classes': {
            0: 'LOW',
            1: 'MEDIUM',
            2: 'HIGH'
        },
        'features': [
            'spo2', 'respiratory_rate', 'respiratory_distress_index',
            'spo2_risk_score', 'rr_risk_score', 'temp_risk_score',
            'temperature', 'heart_rate', 'age', 'sex', 'age_group'
        ],
        'thresholds': {
            'confidence_high': 0.85,
            'confidence_medium': 0.60,
            'uncertainty_alert': 0.02
        }
    }), 200

@app.route('/respiratory/example-patients', methods=['GET'])
def respiratory_example_patients():
    """Get example respiratory patients for testing"""
    try:
        with open('example_patient_healthy.json') as f:
            healthy = json.load(f)
        
        with open('example_patient_high_risk.json') as f:
            high_risk = json.load(f)
        
        return jsonify({
            'healthy': {
                'data': healthy,
                'expected_risk': 'LOW'
            },
            'high_risk': {
                'data': high_risk,
                'expected_risk': 'HIGH'
            }
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# ==================== GENERAL HEALTH ENDPOINTS ====================

@app.route('/general/predict', methods=['POST'])
def general_predict():
    """
    Single general health patient prediction
    
    POST /general/predict
    Body: {
        "age": 45,
        "systolic_bp": 140,
        "diastolic_bp": 90,
        "heart_rate": 95,
        "respiratory_rate": 18,
        "temperature": 37.5,
        "spo2": 96,
        "pain_score": 3,
        "wbc": 7.5,
        "hemoglobin": 13.5,
        "platelet_count": 250,
        "sodium": 138,
        "potassium": 4.0,
        "creatinine": 0.9,
        "glucose": 100,
        "troponin": 0.01,
        "bnp": 50,
        "lactate": 1.5,
        "inr": 1.0,
        "sex": "M",
        "country": "USA",
        "clinical_notes": "Patient presents with chest pain..."  // Optional
    }
    
    Note: Clinical embeddings are generated automatically from clinical_notes
    using ClinicalBERT. Lab values and vital signs are combined for prediction.
    """
    try:
        if general_agent is None:
            return jsonify({'error': 'General Health Agent not loaded'}), 503
        
        patient_data = request.get_json()
        
        # Get prediction (agent validates inputs and generates embeddings)
        result = general_agent.predict(patient_data)
        
        # Convert NumPy types to native Python types for JSON serialization
        result = json.loads(json.dumps(result, cls=NumpyEncoder))
        
        # Add timestamp
        result['timestamp'] = datetime.now().isoformat()
        result['model_type'] = 'multimodal_lightgbm'
        
        logger.info(f"General Health Prediction: {result['risk_level']} (conf: {result['confidence']:.2%})")
        
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"General health prediction error: {e}")
        return jsonify({'error': str(e)}), 400

@app.route('/general/batch', methods=['POST'])
def general_batch_predict():
    """
    Multiple general health patients prediction
    
    POST /general/batch
    Body: [
        {patient1_data},
        {patient2_data},
        ...
    ]
    """
    try:
        if general_agent is None:
            return jsonify({'error': 'General Health Agent not loaded'}), 503
        
        patients = request.get_json()
        
        if not isinstance(patients, list):
            return jsonify({'error': 'Body must be a JSON array'}), 400
        
        results = []
        for i, patient in enumerate(patients):
            try:
                result = general_agent.predict(patient)
                # Convert NumPy types to native Python types
                result = json.loads(json.dumps(result, cls=NumpyEncoder))
                result['patient_index'] = i
                result['timestamp'] = datetime.now().isoformat()
                result['model_type'] = 'multimodal_lightgbm'
                results.append(result)
            except Exception as e:
                results.append({
                    'patient_index': i,
                    'error': str(e),
                    'status': 'error'
                })
        
        logger.info(f"General health batch prediction: {len(results)} patients processed")
        
        return jsonify({
            'total': len(results),
            'predictions': results
        }), 200
        
    except Exception as e:
        logger.error(f"General health batch prediction error: {e}")
        return jsonify({'error': str(e)}), 400

@app.route('/general/model-info', methods=['GET'])
def general_model_info():
    """Get general health model metadata"""
    if general_agent is None:
        return jsonify({'error': 'General Health Agent not loaded'}), 503
    
    info = general_agent.get_model_info()
    return jsonify(info), 200

@app.route('/general/example-patient', methods=['GET'])
def general_example_patient():
    """Get example general health patient for testing"""
    example = {
        'age': 45,
        'systolic_bp': 140,
        'diastolic_bp': 90,
        'heart_rate': 95,
        'respiratory_rate': 18,
        'temperature': 37.5,
        'spo2': 96,
        'pain_score': 3,
        'wbc': 7.5,
        'hemoglobin': 13.5,
        'platelet_count': 250,
        'sodium': 138,
        'potassium': 4.0,
        'creatinine': 0.9,
        'glucose': 100,
        'troponin': 0.01,
        'bnp': 50,
        'lactate': 1.5,
        'inr': 1.0,
        'sex': 'M',
        'country': 'USA',
        'clinical_notes': 'Patient presents with chest pain and elevated blood pressure. No acute distress.'
    }
    return jsonify({
        'example': example,
        'description': 'Medium-risk patient with hypertension and chest pain'
    }), 200

# ==================== LEGACY ENDPOINTS (for backward compatibility) ====================

@app.route('/predict', methods=['POST'])
def legacy_predict():
    """Legacy endpoint - routes to respiratory model"""
    return respiratory_predict()

@app.route('/batch', methods=['POST'])
def legacy_batch():
    """Legacy endpoint - routes to respiratory model"""
    return respiratory_batch_predict()

@app.route('/model-info', methods=['GET'])
def legacy_model_info():
    """Legacy endpoint - routes to respiratory model"""
    return respiratory_model_info()

@app.route('/example-patients', methods=['GET'])
def legacy_example_patients():
    """Legacy endpoint - routes to respiratory model"""
    return respiratory_example_patients()

# ==================== RULE-BASED SAFETY & AGGREGATOR ====================

class RuleBasedSafetyLayer:
    @staticmethod
    def check_vitals(data: dict) -> dict:
        alerts = []
        is_critical = False
        
        spo2 = float(data.get('spo2', 100))
        if spo2 < 90:
            alerts.append(f"CRITICAL SpO2: {spo2}%")
            is_critical = True
            
        hr = float(data.get('heart_rate', 80))
        if hr > 130 or hr < 40:
            alerts.append(f"CRITICAL Heart Rate: {hr} bpm")
            is_critical = True
            
        sbp = float(data.get('systolic_bp', 120))
        if sbp < 90 or sbp > 200:
            alerts.append(f"CRITICAL Systolic BP: {sbp} mmHg")
            is_critical = True
            
        rr = float(data.get('respiratory_rate', 16))
        if rr > 30 or rr < 8:
            alerts.append(f"CRITICAL Respiratory Rate: {rr}")
            is_critical = True
            
        return {
            'is_critical': is_critical,
            'alerts': alerts
        }

class OutputAggregator:
    @staticmethod
    def aggregate(predictions: dict, safety_rules: dict) -> dict:
        risk_scores = {'LOW': 0, 'MEDIUM': 1, 'HIGH': 2}
        reverse_scores = {0: 'LOW', 1: 'MEDIUM', 2: 'HIGH'}
        
        max_risk_score = 0
        confidences = []
        
        # 1. Rule-based layer overrides
        if safety_rules.get('is_critical'):
            max_risk_score = 2
            
        # 2. Check each agent
        for agent_name, result in predictions.items():
            if result.get('status') == 'success':
                risk = result.get('risk_level', 'LOW')
                if 'HIGH' in risk: r = 'HIGH'
                elif 'MID' in risk or 'MEDIUM' in risk: r = 'MEDIUM'
                else: r = 'LOW'
                
                score = risk_scores.get(r, 0)
                if score > max_risk_score:
                    max_risk_score = score
                    
                confidences.append(result.get('confidence', 0.5))
                
        final_risk = reverse_scores[max_risk_score]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.5
        
        uncertainty_high = avg_confidence < 0.70
        
        explanation = "Patient is stable across all systems."
        if final_risk == 'HIGH':
            explanation = "Critical risk identified! "
            if safety_rules.get('alerts'):
                explanation += "Safety alerts: " + ", ".join(safety_rules['alerts']) + ". "
            explanation += "Immediate intervention required."
        elif final_risk == 'MEDIUM':
            explanation = "Elevated risk detected. Please review agent sub-reports and monitor."
            
        if uncertainty_high:
            explanation += " (Note: AI confidence is low. Please review SHAP feature impacts carefully)."
            
        return {
            'final_risk': final_risk,
            'overall_confidence': round(avg_confidence, 4),
            'uncertainty_high': uncertainty_high,
            'explanation': explanation,
            'safety_alerts': safety_rules.get('alerts', [])
        }

# ==================== UNIFIED ENDPOINT ====================

@app.route('/unified/predict', methods=['POST'])
def unified_predict():
    """
    Unified endpoint predicting risk across all 4 models
    """
    try:
        patient_data = request.get_json()
        
        results = {
            'timestamp': datetime.now().isoformat(),
            'status': 'success',
            'predictions': {}
        }
        
        if respiratory_agent:
            resp_res = respiratory_agent.predict(patient_data)
            results['predictions']['respiratory'] = json.loads(json.dumps(resp_res, cls=NumpyEncoder))
        
        if general_agent:
            gen_res = general_agent.predict(patient_data)
            results['predictions']['general'] = json.loads(json.dumps(gen_res, cls=NumpyEncoder))
            
        if cardiac_agent:
            card_res = cardiac_agent.predict(patient_data)
            results['predictions']['cardiac'] = json.loads(json.dumps(card_res, cls=NumpyEncoder))
            
        if sepsis_agent:
            sep_res = sepsis_agent.predict(patient_data)
            results['predictions']['sepsis'] = json.loads(json.dumps(sep_res, cls=NumpyEncoder))
            
        # Step 1: Run Rule-Based Safety Layer
        safety_rules = RuleBasedSafetyLayer.check_vitals(patient_data)
        
        # Step 2: Run Output Aggregation
        aggregation = OutputAggregator.aggregate(results['predictions'], safety_rules)
        results['aggregation'] = aggregation
            
        return jsonify(results), 200
        
    except Exception as e:
        logger.error(f"Unified prediction error: {e}")
        return jsonify({'error': str(e)}), 400

# ==================== FEEDBACK / HITL ENDPOINT ====================

@app.route('/feedback', methods=['POST'])
def feedback():
    """
    Log clinician feedback for continuous learning.
    """
    try:
        data = request.get_json()
        file_exists = os.path.isfile('feedback_log.csv')
        
        with open('feedback_log.csv', 'a', newline='') as csvfile:
            fieldnames = ['timestamp', 'patient_age', 'patient_sex', 'ai_final_risk', 'clinician_override', 'action']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            
            if not file_exists:
                writer.writeheader()
                
            writer.writerow({
                'timestamp': datetime.now().isoformat(),
                'patient_age': data.get('patient_data', {}).get('age', ''),
                'patient_sex': data.get('patient_data', {}).get('sex', ''),
                'ai_final_risk': data.get('ai_final_risk', ''),
                'clinician_override': data.get('clinician_override', ''),
                'action': data.get('action', '')  # 'accept' or 'override'
            })
            
        return jsonify({'status': 'success', 'message': 'Feedback logged successfully'}), 200
    except Exception as e:
        logger.error(f"Feedback logging error: {e}")
        return jsonify({'error': str(e)}), 400

# ==================== ERROR HANDLERS ====================

@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def server_error(e):
    return jsonify({'error': 'Internal server error'}), 500

# ==================== MAIN ====================

if __name__ == '__main__':
    print("\n" + "="*70)
    print("🫁 MULTI-AGENT DIAGNOSTIC API SERVER")
    print("="*70)
    print("\n📊 RESPIRATORY ENDPOINTS:")
    print("  POST http://localhost:8000/respiratory/predict")
    print("  POST http://localhost:8000/respiratory/batch")
    print("  GET  http://localhost:8000/respiratory/model-info")
    print("  GET  http://localhost:8000/respiratory/example-patients")
    
    print("\n🏥 GENERAL HEALTH ENDPOINTS:")
    print("  POST http://localhost:8000/general/predict")
    print("  POST http://localhost:8000/general/batch")
    print("  GET  http://localhost:8000/general/model-info")
    print("  GET  http://localhost:8000/general/example-patient")
    
    print("\n✅ HEALTH CHECK:")
    print("  GET  http://localhost:8000/health")
    
    print("\n⏪ LEGACY ENDPOINTS (backward compatibility):")
    print("  POST http://localhost:8000/predict  → /respiratory/predict")
    print("  POST http://localhost:8000/batch    → /respiratory/batch")
    print("  GET  http://localhost:8000/model-info")
    print("  GET  http://localhost:8000/example-patients")
    
    print("\n" + "="*70)
    print("Starting server on http://localhost:8000...")
    print("="*70 + "\n")
    
    app.run(debug=False, host='0.0.0.0', port=8000)

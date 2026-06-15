"""
Sepsis Agent API Module
Production-ready module for sepsis risk prediction using XGBoost.
"""

import pickle
import numpy as np
from typing import Dict, Any, List, Tuple
import logging

logger = logging.getLogger(__name__)

class SepsisAgent:
    """
    Sepsis agent for ED triage using XGBoost.
    """
    
    # 29 features expected by the Sepsis model
    FEATURE_NAMES = [
        'age', 'sex', 'systolic_bp', 'diastolic_bp', 'heart_rate', 
        'respiratory_rate', 'temperature', 'spo2', 'pain_score', 
        'wbc', 'hemoglobin', 'platelet_count', 'sodium', 'potassium', 
        'creatinine', 'glucose', 'troponin', 'bnp', 'lactate', 'inr', 
        'spo2_risk_score', 'rr_risk_score', 'temp_risk_score', 
        'spo2_deviation', 'rr_deviation', 'respiratory_distress_index', 
        'age_adjusted_resp_risk', 'hr_risk_score', 'sbp_risk_score'
    ]
    
    RISK_CLASSES = {0: 'LOW_RISK', 1: 'MID_RISK', 2: 'HIGH_RISK'}
    
    CONFIDENCE_THRESHOLDS = {
        'HIGH': 0.85,
        'MEDIUM': 0.70,
        'LOW': 0.0
    }
    
    def __init__(self, model_path: str = 'sepsis_xgb_model.pkl'):
        self.model = None
        self.model_loaded = False
        
        try:
            with open(model_path, 'rb') as f:
                self.model = pickle.load(f)
            self.model_loaded = True
            logger.info(f"✓ Sepsis Agent loaded from {model_path}")
        except Exception as e:
            logger.error(f"Error loading sepsis model: {str(e)}")
            
    def validate_input(self, data: Dict[str, Any]) -> Tuple[bool, str, Dict]:
        processed = {}
        
        # Required base vitals
        required_vitals = ['age', 'systolic_bp', 'diastolic_bp', 'heart_rate', 'respiratory_rate', 'temperature', 'spo2']
        for field in required_vitals:
            if field not in data:
                return False, f"Missing required vital sign: {field}", {}
            processed[field] = float(data[field])
            
        sex = data.get('sex', 'M').upper()
        processed['sex'] = 1 if sex == 'F' else 0
        processed['pain_score'] = float(data.get('pain_score', 0))
        
        # Labs
        labs = ['wbc', 'hemoglobin', 'platelet_count', 'sodium', 'potassium', 'creatinine', 'glucose', 'troponin', 'bnp', 'lactate', 'inr']
        default_labs = {
            'wbc': 8.0, 'hemoglobin': 14.0, 'platelet_count': 250.0, 'sodium': 140.0, 'potassium': 4.0,
            'creatinine': 1.0, 'glucose': 100.0, 'troponin': 0.01, 'bnp': 50.0, 'lactate': 1.5, 'inr': 1.0
        }
        
        for lab in labs:
            if lab in data and data[lab] is not None:
                processed[lab] = float(data[lab])
            else:
                processed[lab] = default_labs[lab]
                
        # Calculate risk scores (simplified approximations)
        spo2 = processed['spo2']
        rr = processed['respiratory_rate']
        temp = processed['temperature']
        hr = processed['heart_rate']
        sbp = processed['systolic_bp']
        age = processed['age']
        
        processed['spo2_risk_score'] = 0.1 if spo2 >= 95 else (0.9 if spo2 < 90 else 0.5)
        processed['rr_risk_score'] = 0.2 if 12 <= rr <= 20 else (0.8 if rr > 30 else 0.5)
        processed['temp_risk_score'] = 0.1 if 36.5 <= temp <= 37.5 else (0.7 if temp > 39 or temp < 36.5 else 0.4)
        processed['spo2_deviation'] = 95 - spo2 if spo2 < 95 else 0
        processed['rr_deviation'] = rr - 20 if rr > 20 else (12 - rr if rr < 12 else 0)
        processed['respiratory_distress_index'] = (processed['spo2_risk_score'] + processed['rr_risk_score'] + processed['temp_risk_score']) / 3
        processed['age_adjusted_resp_risk'] = processed['respiratory_distress_index'] * (1 + (age - 40) / 100) if age > 40 else processed['respiratory_distress_index']
        processed['hr_risk_score'] = 0.1 if 60 <= hr <= 100 else 0.8
        processed['sbp_risk_score'] = 0.1 if 90 <= sbp <= 140 else 0.8
        
        return True, "", processed

    def predict(self, patient_data: Dict[str, Any]) -> Dict[str, Any]:
        if not self.model_loaded:
            return {'status': 'error', 'error_message': 'Model not loaded', 'risk_level': 'UNKNOWN'}
            
        is_valid, error_msg, processed_data = self.validate_input(patient_data)
        if not is_valid:
            return {'status': 'error', 'error_message': error_msg, 'risk_level': 'UNKNOWN'}
            
        try:
            features = [processed_data.get(feat, 0) for feat in self.FEATURE_NAMES]
            X = np.array(features).reshape(1, -1)
            
            prediction = self.model.predict(X)[0]
            probabilities = self.model.predict_proba(X)[0]
            risk_level = self.RISK_CLASSES.get(prediction, 'UNKNOWN')
            confidence = float(np.max(probabilities))
            
            if confidence >= self.CONFIDENCE_THRESHOLDS['HIGH']:
                confidence_level = 'HIGH'
            elif confidence >= self.CONFIDENCE_THRESHOLDS['MEDIUM']:
                confidence_level = 'MEDIUM'
            else:
                confidence_level = 'LOW'
                
            return {
                'status': 'success',
                'risk_level': risk_level,
                'confidence': confidence,
                'confidence_level': confidence_level,
                'probabilities': {
                    'low': float(probabilities[0]) if len(probabilities) > 0 else 0,
                    'medium': float(probabilities[1]) if len(probabilities) > 1 else 0,
                    'high': float(probabilities[2]) if len(probabilities) > 2 else 0
                },
                'top_contributing_features': self._get_shap_features(X, prediction),
                'clinical_action': self._get_clinical_action(risk_level, confidence)
            }
        except Exception as e:
            return {'status': 'error', 'error_message': str(e), 'risk_level': 'UNKNOWN'}

    def _get_clinical_action(self, risk_level: str, confidence: float) -> str:
        actions = {
            'LOW_RISK': 'Sepsis risk is low. Routine observation.',
            'MID_RISK': 'Medium sepsis risk. Monitor lactate and vitals.',
            'HIGH_RISK': 'High sepsis risk. Initiate sepsis protocol immediately.'
        }
        return actions.get(risk_level, 'Consult staff')

    def _get_shap_features(self, X: np.ndarray, prediction_class: int) -> List[Dict[str, Any]]:
        try:
            import xgboost as xgb
            d = xgb.DMatrix(X, feature_names=self.FEATURE_NAMES)
            contribs = self.model.get_booster().predict(d, pred_contribs=True)
            
            if len(contribs.shape) == 3: # Multi-class
                if hasattr(self.model, 'classes_'):
                    class_idx = list(self.model.classes_).index(prediction_class)
                else:
                    class_idx = int(prediction_class)
                feature_contribs = contribs[0, class_idx, :-1]
            else: # Binary
                feature_contribs = contribs[0, :-1]
                
            top_indices = np.argsort(np.abs(feature_contribs))[-3:][::-1]
            
            shap_features = []
            for idx in top_indices:
                val = float(feature_contribs[idx])
                shap_features.append({
                    'feature': self.FEATURE_NAMES[idx],
                    'value': round(val, 4),
                    'impact': 'positive' if val > 0 else 'negative'
                })
            return shap_features
        except Exception as e:
            logger.error(f"SHAP error: {e}")
            return []

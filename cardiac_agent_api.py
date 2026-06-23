"""
Cardiac Agent API Module
Production-ready module for cardiac risk prediction using XGBoost.
"""

import pickle
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Tuple
import logging

logger = logging.getLogger(__name__)

class CardiacAgent:
    """
    Cardiac agent for ED triage using XGBoost.
    """
    
    # Feature names in exact order expected by the model
    FEATURE_NAMES = [
        'site_id', 'age', 'sex', 'systolic_bp', 'diastolic_bp', 'heart_rate',
        'respiratory_rate', 'temperature', 'spo2', 'pain_score', 'wbc', 'hemoglobin',
        'platelet_count', 'sodium', 'potassium', 'creatinine', 'glucose', 'troponin',
        'bnp', 'lactate', 'inr', 'wbc_missing', 'hemoglobin_missing',
        'platelet_count_missing', 'sodium_missing', 'potassium_missing',
        'creatinine_missing', 'glucose_missing', 'troponin_missing', 'bnp_missing',
        'lactate_missing', 'inr_missing', 'shock_index', 'pulse_pressure', 'MAP'
    ]
    
    RISK_CLASSES = {0: 'HIGH_RISK', 1: 'HIGH_RISK', 2: 'MEDIUM_RISK', 3: 'LOW_RISK', 4: 'LOW_RISK'}
    
    CONFIDENCE_THRESHOLDS = {
        'HIGH': 0.85,
        'MEDIUM': 0.70,
        'LOW': 0.0
    }
    
    def __init__(self, model_path: str = 'models/xgboost_cardiac_model.pkl'):
        self.model = None
        self.model_loaded = False
        
        try:
            with open(model_path, 'rb') as f:
                self.model = pickle.load(f)
            self.model_loaded = True
            logger.info(f"✓ Cardiac Agent loaded from {model_path}")
        except Exception as e:
            logger.error(f"Error loading cardiac model: {str(e)}")
            
    def validate_input(self, data: Dict[str, Any]) -> Tuple[bool, str, Dict]:
        processed = {}
        
        # Required base vitals
        required_vitals = ['age', 'systolic_bp', 'diastolic_bp', 'heart_rate', 'respiratory_rate', 'temperature', 'spo2']
        for field in required_vitals:
            if field not in data:
                return False, f"Missing required vital sign: {field}", {}
            processed[field] = float(data[field])
            
        # Site ID and Sex
        processed['site_id'] = float(data.get('site_id', 1))
        sex = data.get('sex', 'M').upper()
        processed['sex'] = 1 if sex == 'F' else 0 # Assuming 1 is F, 0 is M
        processed['pain_score'] = float(data.get('pain_score', 0))
        
        # Labs and missing indicators
        labs = ['wbc', 'hemoglobin', 'platelet_count', 'sodium', 'potassium', 'creatinine', 'glucose', 'troponin', 'bnp', 'lactate', 'inr']
        # Default means for imputation if missing
        default_labs = {
            'wbc': 8.0, 'hemoglobin': 14.0, 'platelet_count': 250.0, 'sodium': 140.0, 'potassium': 4.0,
            'creatinine': 1.0, 'glucose': 100.0, 'troponin': 0.01, 'bnp': 50.0, 'lactate': 1.5, 'inr': 1.0
        }
        
        for lab in labs:
            if lab in data and data[lab] is not None:
                processed[lab] = float(data[lab])
                processed[f"{lab}_missing"] = 0.0
            else:
                processed[lab] = default_labs[lab]
                processed[f"{lab}_missing"] = 1.0
                
        # Calculated vitals
        sbp = processed['systolic_bp']
        dbp = processed['diastolic_bp']
        hr = processed['heart_rate']
        
        processed['shock_index'] = hr / sbp if sbp > 0 else 0
        processed['pulse_pressure'] = sbp - dbp
        processed['MAP'] = dbp + (processed['pulse_pressure'] / 3)
        
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
                    'low': float(probabilities[3] + probabilities[4]) if len(probabilities) > 4 else 0,
                    'medium': float(probabilities[2]) if len(probabilities) > 2 else 0,
                    'high': float(probabilities[0] + probabilities[1]) if len(probabilities) > 1 else 0
                },
                'top_contributing_features': self._get_shap_features(X, prediction),
                'clinical_action': self._get_clinical_action(risk_level, confidence)
            }
        except Exception as e:
            return {'status': 'error', 'error_message': str(e), 'risk_level': 'UNKNOWN'}

    def _get_clinical_action(self, risk_level: str, confidence: float) -> str:
        actions = {
            'LOW_RISK': 'Cardiac risk is low. Routine observation.',
            'MEDIUM_RISK': 'Medium cardiac risk. Consider ECG and repeat troponin.',
            'HIGH_RISK': 'High cardiac risk. Immediate cardiology consult.'
        }
        return actions.get(risk_level, 'Consult staff')

    def _get_shap_features(self, X: np.ndarray, prediction_class: int) -> List[Dict[str, Any]]:
        try:
            import xgboost as xgb
            d = xgb.DMatrix(X, feature_names=self.FEATURE_NAMES)
            contribs = self.model.get_booster().predict(d, pred_contribs=True)
            
            if len(contribs.shape) == 3: # Multi-class
                # XGBoost classes_ might be 1,2,3,4,5. Find the index.
                if hasattr(self.model, 'classes_'):
                    class_idx = list(self.model.classes_).index(prediction_class)
                else:
                    # If classes_ is not available, assume it maps directly (e.g. 0-based index)
                    class_idx = int(prediction_class) - 1
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

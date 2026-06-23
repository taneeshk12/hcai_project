"""
General Health Agent API Module - XGBoost Version
Production-ready module for general ED triage risk prediction using XGBoost.

Model: XGBoost Classifier (3-class classification)
Classes: LOW_RISK (0), MID_RISK (1), HIGH_RISK (2)
Training Accuracy: High precision multi-class prediction
Features: 23 vital signs and lab values
"""

import joblib
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Tuple
import json
import logging

logger = logging.getLogger(__name__)


class GeneralHealthAgent:
    """
    General health agent for ED triage using XGBoost.
    
    Predicts risk categories from vital signs and lab values.
    
    Attributes:
        model: XGBoost classifier
        feature_names: List of expected input features
        risk_classes: Risk category names
    """
    
    # Feature names (23 total)
    FEATURE_NAMES = [
        'age', 'systolic_bp', 'diastolic_bp', 'heart_rate',
        'respiratory_rate', 'temperature', 'spo2', 'pain_score',
        'wbc', 'hemoglobin', 'platelet_count', 'sodium',
        'potassium', 'creatinine', 'glucose', 'troponin',
        'bnp', 'lactate', 'inr', 'sex_encoded',
        'country_encoded', 'chest_pain', 'diabetes'
    ]
    
    # Risk classes
    RISK_CLASSES = {0: 'LOW_RISK', 1: 'MID_RISK', 2: 'HIGH_RISK'}
    RISK_CLASS_REVERSE = {'LOW_RISK': 0, 'MID_RISK': 1, 'HIGH_RISK': 2}
    
    # Confidence thresholds
    CONFIDENCE_THRESHOLDS = {
        'HIGH': 0.85,
        'MEDIUM': 0.70,
        'LOW': 0.0
    }
    
    # Valid feature ranges for validation
    FEATURE_RANGES = {
        'age': (0, 150),
        'systolic_bp': (70, 250),
        'diastolic_bp': (30, 150),
        'heart_rate': (30, 200),
        'respiratory_rate': (5, 60),
        'temperature': (35, 42),
        'spo2': (70, 100),
        'pain_score': (0, 10),
        'wbc': (2, 30),
        'hemoglobin': (5, 20),
        'platelet_count': (10, 1000),
        'sodium': (110, 160),
        'potassium': (2, 8),
        'creatinine': (0.2, 10),
        'glucose': (40, 600),
        'troponin': (0, 10),
        'bnp': (0, 1000),
        'lactate': (0, 10),
        'inr': (0.5, 5),
    }
    
    def __init__(self, model_path: str = 'models/general_xgb_model.joblib'):
        """
        Initialize the general health agent.
        
        Args:
            model_path: Path to the XGBoost model pickle file
        """
        self.model = None
        self.model_loaded = False
        
        try:
            self.model = joblib.load(model_path)
            self.model_loaded = True
            logger.info(f"✓ General Health Agent (XGBoost) loaded from {model_path}")
        except FileNotFoundError:
            logger.error(f"Model file not found: {model_path}")
        except Exception as e:
            logger.error(f"Error loading model: {str(e)}")
    
    def validate_input(self, data: Dict[str, Any]) -> Tuple[bool, str, Dict]:
        """
        Validate input data.
        
        Args:
            data: Patient data dictionary
            
        Returns:
            Tuple of (is_valid, error_message, processed_data)
        """
        processed = {}
        
        # Split fields into vitals (always required) and labs (imputed in IMMEDIATE mode)
        required_vitals = [
            'age', 'systolic_bp', 'diastolic_bp', 'heart_rate',
            'respiratory_rate', 'temperature', 'spo2', 'pain_score'
        ]
        
        lab_fields = [
            'wbc', 'hemoglobin', 'platelet_count', 'sodium',
            'potassium', 'creatinine', 'glucose', 'troponin',
            'bnp', 'lactate', 'inr'
        ]
        
        default_labs = {
            'wbc': 7.5, 'hemoglobin': 14.0, 'platelet_count': 250.0, 'sodium': 140.0, 'potassium': 4.0,
            'creatinine': 0.9, 'glucose': 100.0, 'troponin': 0.01, 'bnp': 50.0, 'lactate': 1.2, 'inr': 1.0
        }
        
        triage_mode = data.get('triage_mode', 'ENHANCED')
        
        for field in required_vitals:
            if field not in data:
                return False, f"Missing required vital field: {field}", {}
            try:
                processed[field] = float(data[field])
            except (ValueError, TypeError):
                return False, f"Invalid value for {field}: must be numeric", {}
                
        for field in lab_fields:
            if field not in data:
                if triage_mode == 'IMMEDIATE':
                    processed[field] = default_labs[field]
                else:
                    return False, f"Missing required lab field: {field}", {}
            else:
                try:
                    processed[field] = float(data[field])
                except (ValueError, TypeError):
                    return False, f"Invalid value for {field}: must be numeric", {}
        
        # Validate ranges
        for field, (min_val, max_val) in self.FEATURE_RANGES.items():
            if field in processed:
                if not (min_val <= processed[field] <= max_val):
                    logger.warning(f"Field {field} = {processed[field]} outside typical range ({min_val}-{max_val})")
        
        # Handle optional fields
        sex = data.get('sex', 'M').upper()
        processed['sex_encoded'] = 1 if sex == 'F' else 0
        
        country = data.get('country', 'USA').upper()
        processed['country_encoded'] = 1 if country == 'USA' else 0
        
        processed['chest_pain'] = 1 if data.get('chest_pain', False) else 0
        processed['diabetes'] = 1 if data.get('diabetes', False) else 0
        
        return True, "", processed
    
    def predict(self, patient_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Single patient prediction.
        
        Args:
            patient_data: Dictionary with patient information
            
        Returns:
            Dictionary with prediction results
        """
        if not self.model_loaded:
            return {
                'status': 'error',
                'error_message': 'Model not loaded',
                'risk_level': None,
                'confidence': 0.0,
                'confidence_level': 'UNKNOWN'
            }
        
        # Validate input
        is_valid, error_msg, processed_data = self.validate_input(patient_data)
        if not is_valid:
            return {
                'status': 'error',
                'error_message': error_msg,
                'risk_level': None,
                'confidence': 0.0,
                'confidence_level': 'UNKNOWN'
            }
        
        try:
            # Prepare feature array
            features = [processed_data.get(feat, 0) for feat in self.FEATURE_NAMES]
            X = np.array(features).reshape(1, -1)
            
            # Get prediction
            prediction = self.model.predict(X)[0]
            probabilities = self.model.predict_proba(X)[0]
            
            risk_level = self.RISK_CLASSES[prediction]
            confidence = float(np.max(probabilities))
            
            # Determine confidence level
            if confidence >= self.CONFIDENCE_THRESHOLDS['HIGH']:
                confidence_level = 'HIGH'
            elif confidence >= self.CONFIDENCE_THRESHOLDS['MEDIUM']:
                confidence_level = 'MEDIUM'
            else:
                confidence_level = 'LOW'
            
            # Get top contributing features (using SHAP values)
            top_features = self._get_shap_features(X, prediction)
            
            # Get clinical action
            clinical_action = self._get_clinical_action(risk_level, confidence)
            
            return {
                'status': 'success',
                'risk_level': risk_level,
                'confidence': confidence,
                'confidence_level': confidence_level,
                'clinical_action': clinical_action,
                'probabilities': {
                    'low_risk': float(probabilities[0]),
                    'mid_risk': float(probabilities[1]),
                    'high_risk': float(probabilities[2])
                },
                'top_contributing_features': top_features,
                'clinical_alert': confidence_level == 'LOW'
            }
        
        except Exception as e:
            logger.error(f"Prediction error: {str(e)}")
            return {
                'status': 'error',
                'error_message': str(e),
                'risk_level': None,
                'confidence': 0.0,
                'confidence_level': 'UNKNOWN'
            }
    
    def batch_predict(self, patients_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Batch prediction for multiple patients.
        
        Args:
            patients_data: List of patient dictionaries
            
        Returns:
            Dictionary with batch results
        """
        results = []
        
        for i, patient in enumerate(patients_data):
            result = self.predict(patient)
            result['patient_id'] = i
            results.append(result)
        
        success_count = sum(1 for r in results if r['status'] == 'success')
        
        return {
            'status': 'success',
            'total_patients': len(patients_data),
            'successful_predictions': success_count,
            'failed_predictions': len(patients_data) - success_count,
            'predictions': results
        }
    
    def get_model_info(self) -> Dict[str, Any]:
        """
        Get model metadata and information.
        
        Returns:
            Dictionary with model information
        """
        if not self.model_loaded:
            return {
                'status': 'error',
                'message': 'Model not loaded',
                'loaded': False
            }
        
        return {
            'status': 'success',
            'model_type': 'XGBoost Classifier',
            'model_name': 'best_model_XGBoost',
            'loaded': True,
            'risk_classes': list(self.RISK_CLASSES.values()),
            'n_features': len(self.FEATURE_NAMES),
            'features': self.FEATURE_NAMES,
            'input_required': {
                'vital_signs': [
                    'age', 'systolic_bp', 'diastolic_bp', 'heart_rate',
                    'respiratory_rate', 'temperature', 'spo2', 'pain_score'
                ],
                'lab_values': [
                    'wbc', 'hemoglobin', 'platelet_count', 'sodium',
                    'potassium', 'creatinine', 'glucose', 'troponin',
                    'bnp', 'lactate', 'inr'
                ],
                'demographics': ['age', 'sex', 'country'],
                'optional': ['chest_pain', 'diabetes', 'clinical_notes']
            },
            'risk_thresholds': self.CONFIDENCE_THRESHOLDS,
            'accuracy': 'High precision multi-class classification'
        }
    
    def get_example_patient(self) -> Dict[str, Any]:
        """
        Get example patient data for testing.
        
        Returns:
            Dictionary with example patient data
        """
        return {
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
            'chest_pain': True,
            'diabetes': False
        }
    
    def _get_shap_features(self, X: np.ndarray, prediction_class: int) -> List[Dict[str, Any]]:
        """
        Get local SHAP feature contributions for the specific prediction.
        """
        try:
            import xgboost as xgb
            d = xgb.DMatrix(X, feature_names=self.FEATURE_NAMES)
            contribs = self.model.get_booster().predict(d, pred_contribs=True)
            
            if len(contribs.shape) == 3: # Multi-class
                class_idx = list(self.model.classes_).index(prediction_class)
                feature_contribs = contribs[0, class_idx, :-1]
            else: # Binary
                feature_contribs = contribs[0, :-1]
                
            # Sort by absolute magnitude
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
    
    def _get_clinical_action(self, risk_level: str, confidence: float) -> str:
        """
        Get clinical recommendation based on risk level.
        
        Args:
            risk_level: Predicted risk level
            confidence: Model confidence
            
        Returns:
            Clinical action recommendation
        """
        actions = {
            'LOW_RISK': 'Low risk patient - routine monitoring recommended',
            'MID_RISK': 'Medium risk patient - close monitoring required, escalate if symptoms worsen',
            'HIGH_RISK': 'High risk patient - immediate physician review recommended, consider ICU admission'
        }
        
        action = actions.get(risk_level, 'Consult clinical staff for interpretation')
        
        if confidence < 0.7:
            action += ' (Low confidence - review manually)'
        
        return action


# Example usage
if __name__ == '__main__':
    # Initialize agent
    agent = GeneralHealthAgent('best_model_XGBoost.pkl')
    
    # Example prediction
    patient = agent.get_example_patient()
    result = agent.predict(patient)
    print("Prediction Result:")
    print(json.dumps(result, indent=2))
    
    # Model info
    info = agent.get_model_info()
    print("\nModel Info:")
    print(json.dumps(info, indent=2))

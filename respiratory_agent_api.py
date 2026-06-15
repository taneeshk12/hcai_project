"""
Respiratory Agent API Module
Production-ready module for respiratory risk prediction in multi-agent diagnostic system.

This module provides the RespiratoryAgent class that can be integrated into:
- REST APIs (Flask, FastAPI)
- Microservices and container deployments
- Multi-agent architectures
- Batch prediction pipelines
"""

import joblib
import pandas as pd
import numpy as np
from typing import Dict, Any, List
import json
from datetime import datetime


class RespiratoryAgent:
    """
    Production-ready respiratory agent for multi-agent diagnostic system.
    
    Predicts respiratory risk categories (Low/Medium/High) from vital signs and engineered features.
    Includes uncertainty estimation via ensemble and confidence thresholds for clinical safety.
    
    Model Details:
    - Base Model: RandomForest (300 trees, max_depth=20)
    - Uncertainty: Ensemble of 5 models
    - Training Accuracy: 99.15% on test set
    - Features: 11 (7 numeric + 2 categorical after one-hot encoding)
    
    Risk Classes:
    - 0 (LOW): Routine monitoring
    - 1 (MEDIUM): Increased monitoring frequency
    - 2 (HIGH): Escalate to respiratory specialist
    """
    
    # Required feature schema - only raw vitals from doctor/sensor
    REQUIRED_FEATURES = [
        'spo2', 'respiratory_rate', 'temperature', 'heart_rate', 'age', 'sex', 'age_group'
    ]
    
    # Risk score features - calculated automatically by backend
    CALCULATED_FEATURES = [
        'respiratory_distress_index', 'spo2_risk_score', 'rr_risk_score', 'temp_risk_score'
    ]
    
    # Clinical thresholds
    CONFIDENCE_THRESHOLD_HIGH = 0.85
    UNCERTAINTY_THRESHOLD_HIGH = 0.02
    
    def __init__(self, 
                 pipeline_path: str = 'respiratory_rf_pipeline.joblib',
                 ensemble_path: str = 'respiratory_rf_ensemble.joblib',
                 verbose: bool = False):
        """
        Initialize the Respiratory Agent with pre-trained models.
        
        Args:
            pipeline_path: Path to saved sklearn pipeline with preprocessor and classifier
            ensemble_path: Path to saved ensemble of models for uncertainty estimation
            verbose: If True, print diagnostic information
        
        Raises:
            FileNotFoundError: If model files are not found
            Exception: If model loading fails
        """
        self.verbose = verbose
        self.pipeline_path = pipeline_path
        self.ensemble_path = ensemble_path
        
        try:
            self.pipeline = joblib.load(pipeline_path)
            self.ensemble = joblib.load(ensemble_path)
            if self.verbose:
                print(f"✓ Loaded pipeline from {pipeline_path}")
                print(f"✓ Loaded ensemble of {len(self.ensemble)} models from {ensemble_path}")
        except FileNotFoundError as e:
            raise FileNotFoundError(f"Model file not found: {e}")
        except Exception as e:
            raise Exception(f"Failed to load models: {e}")
        
        # Risk mappings
        self.risk_labels = {0: 'LOW', 1: 'MEDIUM', 2: 'HIGH'}
        self.risk_descriptions = {
            0: 'Low respiratory risk - continue routine monitoring',
            1: 'Medium respiratory risk - increase monitoring frequency',
            2: 'High respiratory risk - escalate to respiratory specialist'
        }
    
    def validate_input(self, patient_features: Dict[str, Any]) -> tuple[bool, str]:
        """
        Validate patient input features.
        
        Args:
            patient_features: Dictionary of patient vital signs
        
        Returns:
            Tuple of (is_valid: bool, error_message: str)
        """
        missing_features = [f for f in self.REQUIRED_FEATURES if f not in patient_features]
        if missing_features:
            return False, f"Missing required features: {missing_features}"
        
        # Validate numeric ranges
        if not 50 <= patient_features.get('spo2', 95) <= 100:
            return False, "SpO2 should be between 50-100%"
        
        if not 0 <= patient_features.get('respiratory_rate', 18) <= 60:
            return False, "Respiratory rate should be between 0-60 breaths/min"
        
        if not 0 <= patient_features.get('temperature', 37) <= 42:
            return False, "Temperature should be between 0-42°C"
        
        if not 0 <= patient_features.get('heart_rate', 80) <= 200:
            return False, "Heart rate should be between 0-200 bpm"
        
        if not 0 <= patient_features.get('age', 40) <= 120:
            return False, "Age should be between 0-120 years"
        
        return True, ""
    
    def calculate_risk_scores(self, patient_features: Dict[str, Any]) -> Dict[str, float]:
        """
        Calculate clinical risk scores from raw vital signs.
        These are automatically computed by the backend, not provided by doctor.
        
        Args:
            patient_features: Dictionary with raw vital signs
        
        Returns:
            Dictionary with calculated risk scores
        """
        spo2 = patient_features.get('spo2', 95)
        rr = patient_features.get('respiratory_rate', 18)
        temp = patient_features.get('temperature', 37)
        
        # SpO2 Risk Score (0-1): Lower SpO2 = Higher risk
        # Normal: 95-100 (score ~0.1), Warning: 90-94 (score ~0.5), Critical: <90 (score ~0.9)
        if spo2 >= 95:
            spo2_risk = 0.1
        elif spo2 >= 90:
            spo2_risk = 0.3 + (95 - spo2) * 0.04  # Gradual increase from 90-95
        else:
            spo2_risk = 0.8 + (90 - min(spo2, 85)) * 0.04  # Critical range
        
        # Respiratory Rate Risk Score (0-1): Abnormal RR = Higher risk
        # Normal: 12-20, Tachypnea: 20-30, Critical: >30
        if 12 <= rr <= 20:
            rr_risk = 0.2
        elif 20 < rr <= 30:
            rr_risk = 0.5 + (rr - 20) * 0.04
        else:  # rr > 30
            rr_risk = 0.85 + min((rr - 30) * 0.02, 0.1)
        
        # Temperature Risk Score (0-1): Abnormal temp = Higher risk
        # Normal: 36.5-37.5, Fever: 37.5-39, High fever: >39
        if 36.5 <= temp <= 37.5:
            temp_risk = 0.1
        elif 37.5 < temp <= 39:
            temp_risk = 0.3 + (temp - 37.5) * 0.1
        else:  # temp > 39 or temp < 36.5
            temp_risk = 0.7 + abs(temp - 37.5) * 0.05
        
        # Respiratory Distress Index: Combines SpO2, RR, and Temperature
        # Higher score = more distress
        respiratory_distress_index = (spo2_risk + rr_risk + temp_risk) / 3
        
        return {
            'spo2_risk_score': round(spo2_risk, 3),
            'rr_risk_score': round(rr_risk, 3),
            'temp_risk_score': round(temp_risk, 3),
            'respiratory_distress_index': round(respiratory_distress_index, 3)
        }
    
    def predict(self, patient_features: Dict[str, Any], 
                return_explanation: bool = True) -> Dict[str, Any]:
        """
        Predict respiratory risk for a patient.
        
        Args:
            patient_features: Dictionary with vital signs and features
            return_explanation: If True, include feature importance explanation
        
        Returns:
            Dictionary with prediction results including:
            {
                'risk_class': int (0/1/2),
                'risk_level': str ('LOW'/'MEDIUM'/'HIGH'),
                'probabilities': dict of class probabilities,
                'confidence': float (0-1, max probability),
                'uncertainty': float (ensemble std),
                'clinical_action': str (recommended action),
                'top_contributing_features': list of feature names,
                'confidence_level': str ('HIGH'/'MEDIUM'/'LOW'),
                'clinical_alert': bool (True if confidence low or uncertainty high),
                'timestamp': datetime str,
                'status': 'success' or 'error'
            }
        """
        result = {'timestamp': datetime.now().isoformat()}
        
        try:
            # Validate input
            is_valid, error_msg = self.validate_input(patient_features)
            if not is_valid:
                result['status'] = 'error'
                result['error_message'] = error_msg
                return result
            
            # Calculate risk scores from raw vitals (BACKEND AUTOMATICALLY DOES THIS)
            risk_scores = self.calculate_risk_scores(patient_features)
            patient_features = {**patient_features, **risk_scores}
            
            # Convert to DataFrame
            df = pd.DataFrame([patient_features])
            
            # Get predictions from pipeline
            pred_class = self.pipeline.predict(df)[0]
            pred_proba = self.pipeline.predict_proba(df)[0]
            
            # Get uncertainty from ensemble
            ens_probas = np.stack([m.predict_proba(df) for m in self.ensemble], axis=0)
            ens_uncertainty = ens_probas.std(axis=0).max()
            
            # Determine confidence level
            max_prob = pred_proba.max()
            if max_prob >= self.CONFIDENCE_THRESHOLD_HIGH and ens_uncertainty < self.UNCERTAINTY_THRESHOLD_HIGH:
                confidence_level = 'HIGH'
                clinical_alert = False
            elif max_prob >= 0.60:
                confidence_level = 'MEDIUM'
                clinical_alert = ens_uncertainty > self.UNCERTAINTY_THRESHOLD_HIGH
            else:
                confidence_level = 'LOW'
                clinical_alert = True
            
            # Get feature explanations if requested
            top_features = []
            if return_explanation:
                model = self.pipeline.named_steps['classifier']
                importances = model.feature_importances_
                top_3_idx = np.argsort(-importances)[:3]
                
                preprocess = self.pipeline.named_steps['preprocessor']
                feature_names = []
                for name, trans, cols in preprocess.transformers_:
                    if name == 'num':
                        feature_names.extend(cols)
                    elif name == 'cat':
                        if hasattr(trans.named_steps['onehot'], 'get_feature_names_out'):
                            feature_names.extend(trans.named_steps['onehot'].get_feature_names_out(cols))
                
                top_features = []
                for i in top_3_idx:
                    if i < len(feature_names):
                        feat_name = feature_names[i]
                        importance_val = float(importances[i])
                        
                        # Heuristic for impact direction on risk
                        impact = 'positive'
                        val = patient_features.get(feat_name, 0)
                        if feat_name == 'spo2' and val >= 95: impact = 'negative'
                        elif feat_name == 'respiratory_rate' and 12 <= val <= 20: impact = 'negative'
                        elif feat_name == 'heart_rate' and 60 <= val <= 100: impact = 'negative'
                        elif feat_name == 'temperature' and 36.5 <= val <= 37.5: impact = 'negative'
                        elif 'risk_score' in feat_name and val < 0.3: impact = 'negative'
                        
                        top_features.append({
                            'feature': feat_name,
                            'value': round(importance_val, 4),
                            'impact': impact
                        })
            
            # Build result
            result.update({
                'risk_class': int(pred_class),
                'risk_level': self.risk_labels[pred_class],
                'probabilities': {
                    'low': float(pred_proba[0]),
                    'medium': float(pred_proba[1]),
                    'high': float(pred_proba[2])
                },
                'confidence': float(max_prob),
                'confidence_level': confidence_level,
                'uncertainty': float(ens_uncertainty),
                'clinical_action': self.risk_descriptions[pred_class],
                'top_contributing_features': top_features,
                'clinical_alert': clinical_alert,
                'status': 'success'
            })
            
            if self.verbose:
                print(f"✓ Prediction: {result['risk_level']} (confidence: {confidence_level})")
            
            return result
            
        except Exception as e:
            result['status'] = 'error'
            result['error_message'] = str(e)
            result['risk_level'] = 'UNKNOWN'
            if self.verbose:
                print(f"✗ Prediction error: {e}")
            return result
    
    def batch_predict(self, patients_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Predict respiratory risk for multiple patients.
        
        Args:
            patients_list: List of patient feature dictionaries
        
        Returns:
            List of prediction results
        """
        results = []
        for i, patient in enumerate(patients_list):
            if self.verbose and (i + 1) % 100 == 0:
                print(f"Processed {i + 1} patients...")
            results.append(self.predict(patient))
        return results
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get metadata about the trained model."""
        model = self.pipeline.named_steps['clf']
        return {
            'model_type': type(model).__name__,
            'n_estimators': model.n_estimators,
            'max_depth': model.max_depth,
            'max_features': model.max_features,
            'n_features': model.n_features_in_,
            'n_classes': model.n_classes_,
            'ensemble_size': len(self.ensemble),
            'required_features': self.REQUIRED_FEATURES,
            'risk_classes': self.risk_labels,
            'confidence_threshold': self.CONFIDENCE_THRESHOLD_HIGH,
            'uncertainty_threshold': self.UNCERTAINTY_THRESHOLD_HIGH
        }


# Convenience function for simple predictions
def predict_respiratory_risk(patient_features: Dict[str, Any]) -> Dict[str, Any]:
    """
    Standalone function for quick predictions.
    
    Args:
        patient_features: Dictionary of patient vital signs
    
    Returns:
        Prediction result dictionary
    """
    agent = RespiratoryAgent()
    return agent.predict(patient_features)


if __name__ == '__main__':
    # Example usage
    print("Respiratory Agent API Module")
    print("=" * 80)
    
    # Load example patients
    with open('example_patient_healthy.json', 'r') as f:
        healthy_patient = json.load(f)
    
    with open('example_patient_high_risk.json', 'r') as f:
        high_risk_patient = json.load(f)
    
    # Initialize agent
    agent = RespiratoryAgent(verbose=True)
    
    # Print model info
    print("\nModel Information:")
    for key, value in agent.get_model_info().items():
        print(f"  {key}: {value}")
    
    # Test predictions
    print("\n" + "=" * 80)
    print("Example Predictions:")
    print("-" * 80)
    
    result_healthy = agent.predict(healthy_patient)
    print(f"\nHealthy Patient: {result_healthy['risk_level']} risk")
    print(f"  Confidence: {result_healthy['confidence']:.4f}")
    print(f"  Action: {result_healthy['clinical_action']}")
    
    result_high = agent.predict(high_risk_patient)
    print(f"\nHigh-Risk Patient: {result_high['risk_level']} risk")
    print(f"  Confidence: {result_high['confidence']:.4f}")
    print(f"  Action: {result_high['clinical_action']}")

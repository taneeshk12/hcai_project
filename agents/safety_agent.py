"""
Safety Verification Agent
=========================
Verifies model predictions against clinical safety rules and alerts.
Computes agreement/contradiction status and safety scores.
"""

from typing import Dict, Any

class SafetyVerificationAgent:
    """
    Compares model triage risk predictions against vital sign safety rules.
    Identifies dangerous contradictions (e.g., predicting Low Risk when vital signs are critical).
    """

    def verify(self, model_prediction: str, patient_vitals: dict, safety_layer_result: dict) -> dict:
        """
        Evaluate risk prediction consistency with safety layer rules.

        Args:
            model_prediction: The risk prediction string (e.g., "LOW_RISK", "HIGH_RISK").
            patient_vitals: Dictionary containing raw vital signs.
            safety_layer_result: Output from RuleBasedSafetyLayer.check_vitals().

        Returns:
            Dict containing safety_status, recommended_risk, safety_score, and alerts.
        """
        is_critical = safety_layer_result.get('is_critical', False)
        alerts = safety_layer_result.get('alerts', [])
        
        # Standardize prediction text to check for LOW, MEDIUM, or HIGH
        pred = str(model_prediction).upper()
        
        # Safety layer recommends HIGH_RISK if any vitals are critical.
        recommended_risk = "HIGH_RISK" if is_critical else "LOW_RISK"
        
        if is_critical:
            # If safety layer detects critical vitals:
            if "HIGH" in pred:
                safety_status = "AGREEMENT"
                safety_score = 100
            elif "LOW" in pred:
                safety_status = "CONTRADICTION"
                safety_score = 0  # Major contradiction: vital signs are critical but predicted Low Risk
            else: # MEDIUM or MID
                safety_status = "CONTRADICTION"
                safety_score = 50  # Moderate contradiction
        else:
            # Vitals are normal/stable, so the model prediction is agreed with
            safety_status = "AGREEMENT"
            safety_score = 100
            
        return {
            "safety_status": safety_status,
            "recommended_risk": recommended_risk,
            "safety_score": safety_score,
            "alerts": alerts
        }

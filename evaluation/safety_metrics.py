"""
Safety Metrics Evaluator
=========================
Calculates classification and clinical safety metrics from clinical feedback
and audit logs. Includes automatic synthetic data seeding.
"""

import os
import csv
from datetime import datetime, timedelta
import random
from typing import Dict, Any, List

class SafetyMetricsEvaluator:
    """
    Computes diagnostic performance and safety metrics for clinical oversight reports.
    """

    FEEDBACK_FILE = "data/feedback_log.csv"
    AUDIT_FILE = "data/safety_audit_log.csv"

    @staticmethod
    def seed_data_if_empty():
        """
        Seeds both feedback_log.csv and safety_audit_log.csv with 50 realistic
        historical entries if they are missing or contain fewer than 10 rows.
        """
        os.makedirs("data", exist_ok=True)
        
        # Check if seeding is needed
        feedback_exists = os.path.exists(SafetyMetricsEvaluator.FEEDBACK_FILE)
        audit_exists = os.path.exists(SafetyMetricsEvaluator.AUDIT_FILE)
        
        needs_seeding = False
        if not feedback_exists or not audit_exists:
            needs_seeding = True
        else:
            with open(SafetyMetricsEvaluator.FEEDBACK_FILE, "r") as f:
                needs_seeding = len(list(csv.reader(f))) < 10

        if not needs_seeding:
            return

        # Seed data generation
        start_time = datetime.now() - timedelta(days=14)
        genders = ["M", "F"]
        risks = ["LOW_RISK", "MID_RISK", "HIGH_RISK"]
        
        feedback_rows = []
        audit_rows = []
        
        for i in range(50):
            patient_id = f"PT-HIST{100 + i}"
            timestamp = (start_time + timedelta(hours=i * 6.5) + timedelta(minutes=random.randint(0, 180))).isoformat()
            age = random.randint(18, 90)
            sex = random.choice(genders)
            
            # Base risk generation
            true_risk_idx = random.choices([0, 1, 2], weights=[0.55, 0.30, 0.15])[0]
            true_risk = risks[true_risk_idx]
            
            # Generate AI prediction (85% accuracy base)
            is_correct = random.random() < 0.86
            if is_correct:
                predicted_risk = true_risk
            else:
                # Disagree
                choices = [r for r in risks if r != true_risk]
                predicted_risk = random.choice(choices)
            
            # Inject a few specific safety rule conditions
            # E.g., vital checks safety override disagreement (predicted low/mid but safety rules detect critical vitals)
            has_vital_alarm = random.random() < 0.10
            safety_status = "AGREEMENT"
            safety_score = 100
            
            if has_vital_alarm and true_risk == "HIGH_RISK" and predicted_risk != "HIGH_RISK":
                # Contraindication! Safety rules recommend HIGH, but AI says LOW/MID.
                safety_status = "CONTRADICTION"
                safety_score = 0 if predicted_risk == "LOW_RISK" else 50
                # Escalation logic forces final prediction to HIGH in the audit log
                final_ai_prediction = "HIGH_RISK"
            else:
                final_ai_prediction = predicted_risk

            # Edge Case: Unsafe Downgrade (True = HIGH, AI Predicted = LOW)
            # Make sure we have exactly 1-2 unsafe downgrades to demonstrate the feature
            if i in [12, 37]:
                true_risk = "HIGH_RISK"
                final_ai_prediction = "LOW_RISK"
                safety_status = "AGREEMENT" # Vitals happened to be stable, but patient was clinically high risk
                safety_score = 100
            
            # Confidence score
            if final_ai_prediction == true_risk:
                confidence = round(random.uniform(0.72, 0.98), 2)
            else:
                confidence = round(random.uniform(0.50, 0.76), 2)
                
            # Agreement score of sub-agents
            if final_ai_prediction == true_risk:
                agreement_score = random.choice([100, 75])
            else:
                agreement_score = random.choice([75, 50, 25])
                
            # Trust score calculation
            trust_score = int(round(0.4 * (confidence * 100) + 0.3 * safety_score + 0.3 * agreement_score))
            
            # Human review status
            human_review_required = "True" if (confidence < 0.70 or safety_status == "CONTRADICTION") else "False"
            
            # Feedback action
            action = "accept" if (final_ai_prediction == true_risk) else "override"
            
            feedback_rows.append({
                'timestamp': timestamp,
                'patient_age': age,
                'patient_sex': sex,
                'ai_final_risk': final_ai_prediction.replace("_RISK", ""),
                'clinician_override': true_risk.replace("_RISK", ""),
                'action': action
            })
            
            # Triage mode distribution for seeder
            triage_mode = 'ENHANCED' if i % 4 == 0 else 'IMMEDIATE'

            audit_rows.append({
                'patient_id': patient_id,
                'prediction': final_ai_prediction,
                'confidence': confidence,
                'trust_score': trust_score,
                'safety_status': safety_status,
                'human_review_required': human_review_required,
                'triage_mode': triage_mode,
                'timestamp': timestamp
            })

        # Write feedback logs
        with open(SafetyMetricsEvaluator.FEEDBACK_FILE, "w", newline='') as f:
            writer = csv.DictWriter(f, fieldnames=['timestamp', 'patient_age', 'patient_sex', 'ai_final_risk', 'clinician_override', 'action'])
            writer.writeheader()
            writer.writerows(feedback_rows)
            
        # Write safety audit logs
        with open(SafetyMetricsEvaluator.AUDIT_FILE, "w", newline='') as f:
            writer = csv.DictWriter(f, fieldnames=['patient_id', 'prediction', 'confidence', 'trust_score', 'safety_status', 'human_review_required', 'triage_mode', 'timestamp'])
            writer.writeheader()
            writer.writerows(audit_rows)

    @staticmethod
    def calculate_metrics() -> Dict[str, Any]:
        """
        Load logged entries and compute performance and safety metrics.

        Returns:
            Dict of diagnostic performance and clinical safety metrics.
        """
        # Ensure we have seeded data
        SafetyMetricsEvaluator.seed_data_if_empty()
        
        # 1. Parse Clinician feedback overrides (data/feedback_log.csv)
        total_eval_cases = 0
        correct_predictions = 0
        
        # For precision/recall/f1-score of the HIGH_RISK class
        # Positive = HIGH, Negative = LOW/MEDIUM
        tp = fp = fn = tn = 0
        
        y_true = []
        y_pred = []
        
        if os.path.exists(SafetyMetricsEvaluator.FEEDBACK_FILE):
            with open(SafetyMetricsEvaluator.FEEDBACK_FILE, "r") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    true_risk = str(row.get('clinician_override', '')).upper()
                    pred_risk = str(row.get('ai_final_risk', '')).upper()
                    
                    if not true_risk or not pred_risk:
                        continue
                        
                    total_eval_cases += 1
                    y_true.append(true_risk)
                    y_pred.append(pred_risk)
                    
                    if true_risk == pred_risk:
                        correct_predictions += 1
                        
                    # Calculate stats specifically for HIGH risk class (Positive Class = HIGH)
                    is_true_high = "HIGH" in true_risk
                    is_pred_high = "HIGH" in pred_risk
                    
                    if is_true_high and is_pred_high:
                        tp += 1
                    elif not is_true_high and is_pred_high:
                        fp += 1
                    elif is_true_high and not is_pred_high:
                        fn += 1
                    else:
                        tn += 1

        accuracy = correct_predictions / total_eval_cases if total_eval_cases > 0 else 0.0
        
        # Calculate Precision, Recall, F1 for the HIGH risk triage category
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1_score = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
        
        # 2. Parse Safety Audit logs (data/safety_audit_log.csv)
        total_audit_cases = 0
        safety_agreements = 0
        total_trust_score = 0.0
        total_confidence = 0.0
        human_reviews_triggered = 0
        
        unsafe_downgrade_count = 0
        total_true_high_risk = 0
        false_negatives_high_risk = 0

        # We can align audit log and feedback log to count unsafe downgrades:
        # Unsafe Downgrade = clinician_override == HIGH and ai_final_risk == LOW
        # False Negative High Risk = clinician_override == HIGH and ai_final_risk != HIGH
        if os.path.exists(SafetyMetricsEvaluator.FEEDBACK_FILE):
            with open(SafetyMetricsEvaluator.FEEDBACK_FILE, "r") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    true_risk = str(row.get('clinician_override', '')).upper()
                    pred_risk = str(row.get('ai_final_risk', '')).upper()
                    
                    if "HIGH" in true_risk:
                        total_true_high_risk += 1
                        if "HIGH" not in pred_risk:
                            false_negatives_high_risk += 1
                        if "LOW" in pred_risk:
                            unsafe_downgrade_count += 1

        # Calculate rate metrics
        unsafe_downgrade_rate = unsafe_downgrade_count / total_eval_cases if total_eval_cases > 0 else 0.0
        false_negative_high_risk_rate = false_negatives_high_risk / total_true_high_risk if total_true_high_risk > 0 else 0.0

        audit_records = []
        immediate_triage_count = 0
        enhanced_triage_count = 0

        if os.path.exists(SafetyMetricsEvaluator.AUDIT_FILE):
            with open(SafetyMetricsEvaluator.AUDIT_FILE, "r") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    total_audit_cases += 1
                    
                    confidence = float(row.get('confidence', 0.5))
                    trust_score = float(row.get('trust_score', 50))
                    safety_status = str(row.get('safety_status', 'AGREEMENT')).upper()
                    review_req = str(row.get('human_review_required', 'False')).strip().lower()
                    triage_mode = str(row.get('triage_mode', 'IMMEDIATE')).upper()
                    
                    if triage_mode == 'ENHANCED':
                        enhanced_triage_count += 1
                    else:
                        immediate_triage_count += 1

                    total_confidence += confidence
                    total_trust_score += trust_score
                    
                    if safety_status == "AGREEMENT":
                        safety_agreements += 1
                        
                    if review_req == "true":
                        human_reviews_triggered += 1
                        
                    # Save a list of logs to send to frontend (limit to last 30 records)
                    audit_records.append({
                        'patient_id': row.get('patient_id'),
                        'prediction': row.get('prediction', '').replace("_RISK", ""),
                        'confidence': f"{confidence * 100:.0f}%" if confidence <= 1.0 else f"{confidence:.0f}%",
                        'trust_score': f"{trust_score:.0f}%",
                        'safety_status': safety_status,
                        'human_review_required': "YES" if review_req == "true" else "NO",
                        'triage_mode': triage_mode,
                        'timestamp': row.get('timestamp')
                    })
                    
        # Reverse list to show newest first
        audit_records = sorted(audit_records, key=lambda x: x['timestamp'], reverse=True)

        avg_confidence = total_confidence / total_audit_cases if total_audit_cases > 0 else 0.0
        avg_trust_score = total_trust_score / total_audit_cases if total_audit_cases > 0 else 0.0
        safety_agreement_rate = safety_agreements / total_audit_cases if total_audit_cases > 0 else 1.0

        return {
            "accuracy": round(accuracy, 4),
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1": round(f1_score, 4),
            "unsafe_downgrade_count": unsafe_downgrade_count,
            "unsafe_downgrade_rate": round(unsafe_downgrade_rate, 4),
            "false_negative_high_risk_rate": round(false_negative_high_risk_rate, 4),
            "safety_agreement_rate": round(safety_agreement_rate, 4),
            "average_trust_score": round(avg_trust_score, 2),
            "average_confidence": round(avg_confidence, 4),
            "human_reviews_triggered": human_reviews_triggered,
            "immediate_triage_count": immediate_triage_count,
            "enhanced_triage_count": enhanced_triage_count,
            "total_cases": total_audit_cases,
            "audit_logs": audit_records[:30] # Return the most recent 30 audit logs
        }

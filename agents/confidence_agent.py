"""
Confidence Agent
================
Analyzes the model's prediction certainty and determines the appropriate
level of human oversight required.

This is a core Human-Centered AI component: instead of blindly trusting
the model, the system uses confidence thresholds to flag uncertain predictions
for mandatory clinician review. This prevents over-reliance on AI.

Design Principle:
    - HIGH confidence (≥85%)  → ADVISORY review (informational, clinician decides)
    - MEDIUM confidence (70-85%) → ADVISORY with a caution note
    - LOW confidence (<70%)   → MANDATORY review (must be seen by a clinician)
    - HIGH_RISK prediction    → Always at minimum ADVISORY/IMMEDIATE
"""

from typing import Any


class ConfidenceAgent:
    """
    Analyzes a model prediction's confidence score and emits a
    human-oversight recommendation.

    Works with the output dict from any of the four sub-agents:
    RespiratoryAgent, CardiacAgent, SepsisAgent, GeneralHealthAgent.

    Attributes:
        HIGH_CONFIDENCE_THRESHOLD   (float): ≥ this → HIGH_CONFIDENCE
        MEDIUM_CONFIDENCE_THRESHOLD (float): ≥ this → MEDIUM_CONFIDENCE
    """

    HIGH_CONFIDENCE_THRESHOLD: float = 0.85
    MEDIUM_CONFIDENCE_THRESHOLD: float = 0.70

    # ------------------------------------------------------------------ #
    # Public API                                                           #
    # ------------------------------------------------------------------ #

    def analyze(self, prediction: dict[str, Any]) -> dict[str, Any]:
        """
        Analyse confidence from a sub-agent prediction dict and return an
        enriched dict with human-oversight fields.

        Args:
            prediction: Output dict from any of the four model sub-agents.
                        Must contain at least a ``confidence`` (float 0-1)
                        and ``risk_level`` (str) key.

        Returns:
            Dict with the following added/overwritten keys:
                confidence_category   : "HIGH_CONFIDENCE" | "MEDIUM_CONFIDENCE" | "LOW_CONFIDENCE"
                human_review_status   : "ADVISORY" | "MANDATORY"
                review_urgency        : "IMMEDIATE" | "WITHIN_4H" | "ROUTINE"
                review_message        : human-readable string for clinicians
                action_required       : bool — True when MANDATORY or HIGH risk
        """
        confidence: float = float(prediction.get("confidence", 0.5))
        risk_level: str = prediction.get("risk_level", "UNKNOWN") or "UNKNOWN"

        confidence_category = self._categorize_confidence(confidence)
        human_review_status = self._determine_review_status(confidence_category, risk_level)
        review_urgency = self._determine_urgency(human_review_status, risk_level)
        review_message = self._build_review_message(
            confidence, confidence_category, human_review_status, risk_level
        )
        action_required = human_review_status == "MANDATORY" or "HIGH" in risk_level.upper()

        return {
            **prediction,
            "confidence_category": confidence_category,
            "human_review_status": human_review_status,
            "review_urgency": review_urgency,
            "review_message": review_message,
            "action_required": action_required,
        }

    def evaluate_probabilities(self, probabilities: dict) -> dict:
        """
        Evaluate prediction certainty using model probabilities.
        Conforms to FEATURE 1 requirements.
        """
        if not probabilities:
            return {
                "predicted_class": "UNKNOWN",
                "confidence_score": 0.0,
                "confidence_level": "LOW",
                "human_review_required": True
            }
            
        prob_low = float(probabilities.get('low', probabilities.get('low_risk', 0.0)))
        prob_mid = float(probabilities.get('medium', probabilities.get('mid_risk', 0.0)))
        prob_high = float(probabilities.get('high', probabilities.get('high_risk', 0.0)))
        
        probs = {
            "LOW_RISK": prob_low,
            "MID_RISK": prob_mid,
            "HIGH_RISK": prob_high
        }
        
        predicted_class = max(probs, key=probs.get)
        confidence_score = probs[predicted_class]
        
        if confidence_score >= 0.85:
            confidence_level = "HIGH"
        elif confidence_score >= 0.70:
            confidence_level = "MEDIUM"
        else:
            confidence_level = "LOW"
            
        human_review_required = confidence_level == "LOW"
        
        return {
            "predicted_class": predicted_class,
            "confidence_score": confidence_score,
            "confidence_level": confidence_level,
            "human_review_required": human_review_required
        }

    def summarize(
        self, all_predictions: dict[str, dict], patient_data: dict[str, Any] = None
    ) -> dict[str, Any]:
        """
        Produce an aggregate confidence summary across all four sub-agents,
        enriched with sub-agent conflict detection and data completeness checks.

        Args:
            all_predictions: Dict of agent_name → prediction dict (already
                             processed by .analyze()).
            patient_data: Raw patient vital/lab signs dictionary.

        Returns:
            Dict with overall confidence stats, uncertainty details, and oversight recommendations.
        """
        scores = [
            float(p.get("confidence", 0.5))
            for p in all_predictions.values()
            if p.get("status") == "success"
        ]
        categories = [
            p.get("confidence_category", "LOW_CONFIDENCE")
            for p in all_predictions.values()
            if p.get("status") == "success"
        ]
        statuses = [
            p.get("human_review_status", "ADVISORY")
            for p in all_predictions.values()
            if p.get("status") == "success"
        ]

        avg_confidence = sum(scores) / len(scores) if scores else 0.5
        overall_category = self._categorize_confidence(avg_confidence)
        
        # ── 1. Sub-Agent Dissonance/Conflict Check ──
        risk_scores = []
        for p in all_predictions.values():
            if p.get("status") == "success":
                risk = p.get("risk_level", "LOW").upper()
                if "HIGH" in risk:
                    risk_scores.append(2)
                elif "MID" in risk or "MEDIUM" in risk:
                    risk_scores.append(1)
                else:
                    risk_scores.append(0)
        
        dissonance_conflict = False
        if len(risk_scores) >= 2:
            max_risk = max(risk_scores)
            min_risk = min(risk_scores)
            if max_risk - min_risk >= 2:
                dissonance_conflict = True

        # ── 2. Data Completeness (Missing Labs) Check ──
        critical_labs = ['troponin', 'lactate', 'bnp', 'wbc', 'creatinine']
        missing_labs = []
        if patient_data:
            for lab in critical_labs:
                val = patient_data.get(lab)
                if val is None or val == "" or str(val).strip() == "":
                    missing_labs.append(lab)
        
        missing_count = len(missing_labs)
        missing_labs_conflict = missing_count >= 3

        # ── 3. Combine and Aggregate Uncertainty ──
        low_confidence = avg_confidence < 0.70
        uncertainty_high = low_confidence or dissonance_conflict or missing_labs_conflict

        # If there's high uncertainty or sub-agent conflict, force review status to MANDATORY
        overall_status = "MANDATORY" if ("MANDATORY" in statuses or uncertainty_high) else "ADVISORY"

        # ── 4. Build Structured Uncertainty Explanations ──
        uncertainty_factors = []
        if low_confidence:
            uncertainty_factors.append(
                f"Low Model Confidence: Overall AI confidence is low ({avg_confidence * 100:.1f}%), "
                f"falling below the 70% safety threshold."
            )
        if dissonance_conflict:
            conflict_details = []
            for agent, p in all_predictions.items():
                if p.get("status") == "success":
                    r = p.get("risk_level", "LOW").replace("_RISK", "").replace("_ESI", "").title()
                    conflict_details.append(f"{agent.capitalize()} Agent ({r})")
            uncertainty_factors.append(
                f"Sub-agent Conflict: Severe disagreement between sub-agents: {', '.join(conflict_details)}."
            )
        if missing_labs_conflict:
            missing_labs_formatted = [l.upper() for l in missing_labs]
            uncertainty_factors.append(
                f"Data Completeness: {missing_count} critical labs ({', '.join(missing_labs_formatted)}) "
                f"are missing and default-imputed, reducing prediction accuracy."
            )

        if uncertainty_high:
            explanations = []
            if low_confidence:
                explanations.append("The machine learning models are reporting low statistical certainty for this vital profile.")
            if dissonance_conflict:
                explanations.append("Different diagnostic agents are reporting conflicting risk assessments, indicating clinical complexity.")
            if missing_labs_conflict:
                explanations.append("Important diagnostic labs are missing. Imputed defaults are being used, which may skew the predictions.")
            
            explanations.append("Mandatory clinician review of raw telemetry and clinical inputs is required. Do not rely on AI assessment alone.")
            uncertainty_explanation = " ".join(explanations)
        else:
            uncertainty_explanation = (
                "The AI predictions are consistent across sub-agents with high statistical confidence "
                "and complete vital/laboratory data."
            )

        return {
            "avg_confidence": round(avg_confidence, 4),
            "avg_confidence_pct": f"{avg_confidence * 100:.1f}%",
            "overall_confidence_category": overall_category,
            "overall_human_review_status": overall_status,
            "per_agent_categories": categories,
            "uncertainty_high": uncertainty_high,
            "dissonance_conflict": dissonance_conflict,
            "missing_labs_conflict": missing_labs_conflict,
            "missing_labs": missing_labs,
            "uncertainty_factors": uncertainty_factors,
            "uncertainty_explanation": uncertainty_explanation,
        }


    # ------------------------------------------------------------------ #
    # Private helpers                                                      #
    # ------------------------------------------------------------------ #

    def _categorize_confidence(self, confidence: float) -> str:
        if confidence >= self.HIGH_CONFIDENCE_THRESHOLD:
            return "HIGH_CONFIDENCE"
        if confidence >= self.MEDIUM_CONFIDENCE_THRESHOLD:
            return "MEDIUM_CONFIDENCE"
        return "LOW_CONFIDENCE"

    def _determine_review_status(self, category: str, risk_level: str) -> str:
        """LOW confidence always triggers MANDATORY human review."""
        if category == "LOW_CONFIDENCE":
            return "MANDATORY"
        if "HIGH" in risk_level.upper() and category != "HIGH_CONFIDENCE":
            return "MANDATORY"
        return "ADVISORY"

    def _determine_urgency(self, review_status: str, risk_level: str) -> str:
        risk_up = risk_level.upper()
        if "HIGH" in risk_up:
            return "IMMEDIATE"
        if review_status == "MANDATORY":
            return "WITHIN_4H"
        return "ROUTINE"

    def _build_review_message(
        self,
        confidence: float,
        category: str,
        status: str,
        risk_level: str,
    ) -> str:
        pct = f"{confidence * 100:.1f}%"
        risk_clean = risk_level.replace("_", " ").title()

        if status == "MANDATORY" and category == "LOW_CONFIDENCE":
            return (
                f"⚠️  LOW CONFIDENCE ({pct}) — Model certainty is insufficient. "
                f"Mandatory clinician review required before acting on this prediction."
            )
        if "HIGH" in risk_level.upper():
            return (
                f"⚠️  {risk_clean} — Model confidence is {category.replace('_', ' ').lower()} ({pct}). "
                f"Immediate physician review recommended."
            )
        if category == "MEDIUM_CONFIDENCE":
            return (
                f"ℹ️  {risk_clean} — Moderate model confidence ({pct}). "
                f"Review the SHAP feature drivers before finalising clinical action."
            )
        return (
            f"✅  {risk_clean} — High model confidence ({pct}). "
            f"Prediction is reliable; clinician review is advisory."
        )

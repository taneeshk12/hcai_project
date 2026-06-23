"""
Summary Agent (HCAI Orchestrator)
===================================
Orchestrates all four HCAI agents in the correct order:
    1. ConfidenceAgent  — analyzes confidence for each sub-agent prediction
    2. SymptomAgent     — extracts clinical context from raw patient data
    3. LLMAgent         — generates unified narrative interpretation

Produces a complete ``hcai_context`` payload used by:
    - ReportGenerator (for full JSON reports)
    - /unified/predict endpoint (returns ``hcai_lite`` for React dashboard)
    - /hcai/analyze endpoint (returns full HCAI report)
"""

import logging
from typing import Any

from agents.confidence_agent import ConfidenceAgent
from agents.symptom_agent import SymptomAgent
from agents.llm_agent import LLMAgent

logger = logging.getLogger(__name__)


class SummaryAgent:
    """
    Orchestrates the full HCAI pipeline for a single patient encounter.

    Usage:
        agent = SummaryAgent()

        # Lightweight mode (no LLM) — used in /unified/predict
        lite = agent.build_lite(patient_data, predictions, aggregation)

        # Full mode (with LLM) — used in /hcai/analyze
        full = agent.build_full(patient_data, predictions, aggregation)
    """

    def __init__(self) -> None:
        self.confidence_agent = ConfidenceAgent()
        self.symptom_agent = SymptomAgent()
        self.llm_agent = LLMAgent()

    # ------------------------------------------------------------------ #
    # Public API                                                           #
    # ------------------------------------------------------------------ #

    def build_lite(
        self,
        patient_data: dict[str, Any],
        predictions: dict[str, dict],
        aggregation: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Lightweight HCAI context — no LLM call.
        Used in the enriched /unified/predict response.

        Returns:
            hcai_lite dict with confidence + symptom context (no LLM).
        """
        # Step 1: Confidence analysis across all sub-agents
        enriched_preds, confidence_summary = self._run_confidence_analysis(predictions, patient_data)

        # Step 2: Symptom extraction
        symptom_context = self.symptom_agent.analyze(patient_data)

        # Step 3: Derive final risk from aggregation
        final_risk = aggregation.get("final_risk", "UNKNOWN")
        overall_confidence = aggregation.get("overall_confidence", 0.5)
        overall_category = self.confidence_agent._categorize_confidence(overall_confidence)
        
        # Pull aggregated status and uncertainty details from confidence_summary
        overall_status = confidence_summary.get("overall_human_review_status", "ADVISORY")
        uncertainty_high = confidence_summary.get("uncertainty_high", False)
        uncertainty_factors = confidence_summary.get("uncertainty_factors", [])
        uncertainty_explanation = confidence_summary.get("uncertainty_explanation", "")

        # Build review message for the aggregated result
        review_message = self.confidence_agent._build_review_message(
            overall_confidence, overall_category, overall_status, final_risk
        )

        return {
            # Confidence
            "confidence_category": overall_category,
            "confidence_pct": f"{overall_confidence * 100:.1f}%",
            "human_review_status": overall_status,
            "review_urgency": self.confidence_agent._determine_urgency(overall_status, final_risk),
            "review_message": review_message,
            "action_required": overall_status == "MANDATORY" or "HIGH" in final_risk.upper(),
            "uncertainty_high": uncertainty_high,
            "uncertainty_factors": uncertainty_factors,
            "uncertainty_explanation": uncertainty_explanation,
            # Per-agent confidence enrichment
            "per_agent_confidence": {
                k: {
                    "confidence_category": v.get("confidence_category"),
                    "human_review_status": v.get("human_review_status"),
                }
                for k, v in enriched_preds.items()
                if v.get("status") == "success"
            },
            # Symptoms
            "detected_symptoms": symptom_context["detected_symptoms"],
            "symptom_count": symptom_context["symptom_count"],
            "clinical_presentations": symptom_context["clinical_presentations"],
            "clinical_summary": symptom_context["clinical_summary"],
            "clinical_notes_display": symptom_context.get("clinical_notes_display"),
        }

    def build_full(
        self,
        patient_data: dict[str, Any],
        predictions: dict[str, dict],
        aggregation: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Full HCAI context — includes LLM interpretation.
        Used in the /hcai/analyze endpoint.

        Returns:
            hcai_full dict with confidence + symptom + LLM fields.
        """
        # Build lite context first (reuses confidence + symptom analysis)
        lite = self.build_lite(patient_data, predictions, aggregation)

        final_risk = aggregation.get("final_risk", "UNKNOWN")
        overall_confidence = aggregation.get("overall_confidence", 0.5)
        safety_alerts = aggregation.get("safety_alerts", [])

        # Collect top SHAP features across all successful predictions
        all_shap: list[dict] = []
        for pred in predictions.values():
            if pred.get("status") == "success":
                features = pred.get("top_contributing_features", [])
                all_shap.extend(features)

        # Sort by absolute impact and deduplicate
        seen: set[str] = set()
        unique_shap: list[dict] = []
        for f in sorted(all_shap, key=lambda x: abs(x.get("value", 0)), reverse=True):
            if f["feature"] not in seen:
                unique_shap.append(f)
                seen.add(f["feature"])

        # Step 3: LLM interpretation
        llm_result = self.llm_agent.interpret_unified(
            final_risk=final_risk,
            overall_confidence=overall_confidence,
            confidence_category=lite["confidence_category"],
            all_shap_features=unique_shap,
            detected_symptoms=lite["detected_symptoms"],
            clinical_summary=lite["clinical_summary"],
            safety_alerts=safety_alerts,
            uncertainty_factors=lite.get("uncertainty_factors", []),
        )

        # Build SHAP summary text
        shap_driver_names = [
            f.get("feature", "").replace("_", " ").title()
            for f in unique_shap[:3]
        ]
        shap_summary = (
            f"Risk elevated by: {', '.join(shap_driver_names)}."
            if shap_driver_names
            else "No dominant SHAP drivers identified."
        )

        # Build clinical recommendation
        recommendation = self._build_recommendation(
            final_risk,
            lite["human_review_status"],
            lite["review_urgency"],
            lite["detected_symptoms"],
        )

        return {
            **lite,
            # LLM
            "llm_interpretation": llm_result["llm_interpretation"],
            "interpretation_source": llm_result["interpretation_source"],
            # SHAP aggregated
            "shap_top_features": unique_shap[:5],
            "shap_summary": shap_summary,
            # Final recommendation
            "recommendation": recommendation,
            # Raw safety alerts for report
            "safety_alerts": safety_alerts,
            # Disclaimer
            "disclaimer": (
                "This report is generated by an AI decision support system. "
                "It does not constitute a medical diagnosis or treatment plan. "
                "All clinical decisions must be made by qualified healthcare professionals. "
                "The AI model uses structured clinical data only for risk prediction; "
                "clinical notes are used for context display only."
            ),
        }

    # ------------------------------------------------------------------ #
    # Private helpers                                                      #
    # ------------------------------------------------------------------ #

    def _run_confidence_analysis(
        self, predictions: dict[str, dict], patient_data: dict[str, Any] = None
    ) -> tuple[dict[str, dict], dict[str, Any]]:
        """Run ConfidenceAgent on each sub-agent prediction."""
        enriched: dict[str, dict] = {}
        for agent_name, pred in predictions.items():
            if pred.get("status") == "success":
                enriched[agent_name] = self.confidence_agent.analyze(pred)
            else:
                enriched[agent_name] = pred  # pass through errors unchanged

        summary = self.confidence_agent.summarize(enriched, patient_data)
        return enriched, summary

    def _build_recommendation(
        self,
        final_risk: str,
        review_status: str,
        urgency: str,
        symptoms: list[str],
    ) -> str:
        if "HIGH" in final_risk.upper():
            return "Immediate physician evaluation. Consider urgent investigations and monitoring."
        if review_status == "MANDATORY":
            return "Mandatory clinician review required. AI confidence is low — do not act on this prediction alone."
        if "MID" in final_risk.upper() or "MEDIUM" in final_risk.upper():
            return "Increased monitoring recommended. Escalate to senior clinician if symptoms worsen."
        return "Routine monitoring. Reassess if clinical condition changes."

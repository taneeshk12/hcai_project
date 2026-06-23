"""
LLM Agent (Groq Integration)
==============================
Generates a clinician-friendly, plain-English interpretation of the
multi-agent model outputs using the Groq API (Llama / Mixtral).

IMPORTANT CONSTRAINTS:
    - The LLM is strictly an INTERPRETER, not a DIAGNOSTICIAN.
    - It must NOT diagnose diseases, NOT recommend specific treatments.
    - Its role: explain what the model found, why it was flagged, and
      what the clinician should be aware of — in ≤ 150 words.
    - If Groq is unavailable (no API key, rate limit, timeout), a
      deterministic rule-based fallback is used so the system never fails.

Usage:
    agent = LLMAgent()
    result = agent.interpret(
        agent_name="general",
        risk_level="HIGH_RISK",
        confidence=0.92,
        confidence_category="HIGH_CONFIDENCE",
        shap_features=[...],
        detected_symptoms=[...],
        clinical_summary="45-year-old male..."
    )
    # result["llm_interpretation"] -> str
    # result["interpretation_source"] -> "groq_llm" | "rule_based"
"""

import os
import logging
from typing import Any

logger = logging.getLogger(__name__)


class LLMAgent:
    """
    Groq-powered clinical interpretation agent with a rule-based fallback.

    Loads the Groq API key from the environment variable GROQ_API_KEY.
    If the key is absent or the request fails, falls back to a deterministic
    template-based interpretation (no external dependency required).
    """

    GROQ_MODEL = "llama-3.1-8b-instant"
    MAX_TOKENS = 250
    TIMEOUT = 12  # seconds

    SYSTEM_PROMPT = """You are a clinical AI system assistant embedded in a hospital triage decision support tool.
Your ONLY role is to explain, in plain English, why an AI risk model flagged this patient.

STRICT RULES — follow every rule without exception:
1. Do NOT diagnose any disease or condition.
2. Do NOT recommend specific medications, treatments, or procedures.
3. Do NOT speculate beyond what the model's data shows.
4. Limit your response to 3-4 sentences (≤ 150 words).
5. Use clear, non-technical language suitable for a clinician skimming a dashboard.
6. Start with: "The AI triage model has assessed this patient as [RISK] with [CONFIDENCE] confidence."
7. Mention the top 2-3 clinical drivers by name.
8. End with a brief human-review statement."""

    def __init__(self) -> None:
        self._client = None
        self._api_key = os.getenv("GROQ_API_KEY", "")
        if self._api_key:
            try:
                from groq import Groq  # type: ignore
                self._client = Groq(api_key=self._api_key)
                logger.info("✓ LLMAgent: Groq client initialised.")
            except ImportError:
                logger.warning("LLMAgent: groq package not installed. Using rule-based fallback.")
            except Exception as exc:
                logger.warning(f"LLMAgent: Groq init failed ({exc}). Using rule-based fallback.")
        else:
            logger.info("LLMAgent: No GROQ_API_KEY set. Using rule-based fallback.")

    # ------------------------------------------------------------------ #
    # Public API                                                           #
    # ------------------------------------------------------------------ #

    def interpret(
        self,
        agent_name: str,
        risk_level: str,
        confidence: float,
        confidence_category: str,
        shap_features: list[dict],
        detected_symptoms: list[str],
        clinical_summary: str,
    ) -> dict[str, str]:
        """
        Generate a clinician-friendly interpretation of model outputs.

        Args:
            agent_name:           Name of sub-agent (e.g., "respiratory", "cardiac")
            risk_level:           Predicted risk level (e.g., "HIGH_RISK")
            confidence:           Float 0-1 model confidence
            confidence_category:  "HIGH_CONFIDENCE" | "MEDIUM_CONFIDENCE" | "LOW_CONFIDENCE"
            shap_features:        List of {feature, value, impact} dicts
            detected_symptoms:    List of symptom name strings from SymptomAgent
            clinical_summary:     Plain-text summary from SymptomAgent

        Returns:
            Dict with keys:
                llm_interpretation  : str
                interpretation_source : "groq_llm" | "rule_based"
        """
        if self._client:
            try:
                return self._call_groq(
                    agent_name, risk_level, confidence, confidence_category,
                    shap_features, detected_symptoms, clinical_summary,
                )
            except Exception as exc:
                logger.warning(f"LLMAgent: Groq call failed ({exc}). Falling back to rule-based.")

        # Fallback
        return self._rule_based_interpretation(
            agent_name, risk_level, confidence, confidence_category,
            shap_features, detected_symptoms,
        )

    def interpret_unified(
        self,
        final_risk: str,
        overall_confidence: float,
        confidence_category: str,
        all_shap_features: list[dict],
        detected_symptoms: list[str],
        clinical_summary: str,
        safety_alerts: list[str],
        uncertainty_factors: list[str] = None,
    ) -> dict[str, str]:
        """
        Generate a unified interpretation across all four sub-agents.

        Used by the /hcai/analyze endpoint after aggregation.
        """
        if self._client:
            try:
                return self._call_groq_unified(
                    final_risk, overall_confidence, confidence_category,
                    all_shap_features, detected_symptoms, clinical_summary, safety_alerts,
                    uncertainty_factors,
                )
            except Exception as exc:
                logger.warning(f"LLMAgent (unified): Groq call failed ({exc}). Falling back.")

        return self._rule_based_unified(
            final_risk, overall_confidence, confidence_category,
            all_shap_features, detected_symptoms, uncertainty_factors,
        )

    # ------------------------------------------------------------------ #
    # Groq calls                                                           #
    # ------------------------------------------------------------------ #

    def _call_groq(
        self, agent_name, risk_level, confidence, confidence_category,
        shap_features, detected_symptoms, clinical_summary,
    ) -> dict[str, str]:
        top_features = [f["feature"].replace("_", " ") for f in shap_features[:3]] if shap_features else []
        symptoms_str = ", ".join(detected_symptoms[:5]) if detected_symptoms else "none detected"
        pct = f"{confidence * 100:.1f}%"
        cat = confidence_category.replace("_", " ").lower()
        risk_clean = risk_level.replace("_", " ").upper()

        user_message = (
            f"Sub-agent: {agent_name.capitalize()} Risk Model\n"
            f"Risk prediction: {risk_clean}\n"
            f"Confidence: {pct} ({cat})\n"
            f"Top clinical drivers (SHAP): {', '.join(top_features) if top_features else 'unavailable'}\n"
            f"Detected clinical findings: {symptoms_str}\n"
            f"Clinical summary: {clinical_summary[:300]}\n\n"
            f"Provide a concise, plain-English interpretation for the attending clinician."
        )

        response = self._client.chat.completions.create(
            model=self.GROQ_MODEL,
            messages=[
                {"role": "system", "content": self.SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            max_tokens=self.MAX_TOKENS,
            temperature=0.2,
            timeout=self.TIMEOUT,
        )
        text = response.choices[0].message.content.strip()
        return {"llm_interpretation": text, "interpretation_source": "groq_llm"}

    def _call_groq_unified(
        self, final_risk, overall_confidence, confidence_category,
        all_shap_features, detected_symptoms, clinical_summary, safety_alerts,
        uncertainty_factors=None,
    ) -> dict[str, str]:
        top_features = [f["feature"].replace("_", " ") for f in all_shap_features[:3]] if all_shap_features else []
        symptoms_str = ", ".join(detected_symptoms[:6]) if detected_symptoms else "none detected"
        alerts_str = ", ".join(safety_alerts[:3]) if safety_alerts else "none"
        pct = f"{overall_confidence * 100:.1f}%"
        cat = confidence_category.replace("_", " ").lower()
        risk_clean = final_risk.replace("_", " ").upper()
        factors_str = "; ".join(uncertainty_factors) if uncertainty_factors else "none"

        user_message = (
            f"UNIFIED MULTI-AGENT TRIAGE ASSESSMENT\n"
            f"Overall risk: {risk_clean}\n"
            f"Overall confidence: {pct} ({cat})\n"
            f"Active safety alerts: {alerts_str}\n"
            f"Uncertainty factors: {factors_str}\n"
            f"Primary clinical drivers across all agents: {', '.join(top_features) if top_features else 'unavailable'}\n"
            f"Detected clinical findings: {symptoms_str}\n"
            f"Clinical summary: {clinical_summary[:400]}\n\n"
            f"Provide a unified, plain-English interpretation for the attending clinician covering all four sub-agents. If uncertainty factors are present (e.g. sub-agent conflicts or missing labs), explain them and advise caution."
        )

        response = self._client.chat.completions.create(
            model=self.GROQ_MODEL,
            messages=[
                {"role": "system", "content": self.SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            max_tokens=self.MAX_TOKENS,
            temperature=0.2,
            timeout=self.TIMEOUT,
        )
        text = response.choices[0].message.content.strip()
        return {"llm_interpretation": text, "interpretation_source": "groq_llm"}

    # ------------------------------------------------------------------ #
    # Rule-based fallback                                                  #
    # ------------------------------------------------------------------ #

    def _rule_based_interpretation(
        self, agent_name, risk_level, confidence, confidence_category,
        shap_features, detected_symptoms,
    ) -> dict[str, str]:
        pct = f"{confidence * 100:.1f}%"
        cat = confidence_category.replace("_", " ").title()
        risk_clean = risk_level.replace("_", " ").title()
        agent_clean = agent_name.capitalize()

        top_features = [f["feature"].replace("_", " ").title() for f in shap_features[:3]] if shap_features else []
        feat_str = ", ".join(top_features) if top_features else "clinical biomarkers"

        symptoms_str = ""
        if detected_symptoms:
            symptoms_str = f" The patient's presentation includes: {', '.join(detected_symptoms[:3])}."

        review_note = (
            "Immediate physician review is strongly recommended."
            if "HIGH" in risk_level
            else "Clinician review is advised to confirm this assessment."
        )

        text = (
            f"The AI triage model ({agent_clean} sub-agent) has assessed this patient as "
            f"{risk_clean} with {pct} confidence ({cat}). "
            f"The primary drivers were: {feat_str}.{symptoms_str} "
            f"{review_note}"
        )
        return {"llm_interpretation": text, "interpretation_source": "rule_based"}

    def _rule_based_unified(
        self, final_risk, overall_confidence, confidence_category,
        all_shap_features, detected_symptoms, uncertainty_factors=None,
    ) -> dict[str, str]:
        pct = f"{overall_confidence * 100:.1f}%"
        cat = confidence_category.replace("_", " ").title()
        risk_clean = final_risk.replace("_", " ").title()

        top_features = [f["feature"].replace("_", " ").title() for f in all_shap_features[:3]] if all_shap_features else []
        feat_str = ", ".join(top_features) if top_features else "clinical biomarkers"

        symptoms_str = ""
        if detected_symptoms:
            sym_list = ", ".join(detected_symptoms[:4])
            symptoms_str = f" The patient's notes indicate: {sym_list}."

        review_note = (
            "Immediate physician evaluation is strongly recommended."
            if "HIGH" in final_risk
            else "Clinician review is advised."
        )

        uncertainty_note = ""
        if uncertainty_factors:
            uncertainty_note = f" Note on AI Uncertainty: {'; '.join(uncertainty_factors)}."

        text = (
            f"The AI triage model has assessed this patient as {risk_clean} with {pct} confidence ({cat}). "
            f"The primary drivers were: {feat_str}.{symptoms_str}{uncertainty_note} {review_note}"
        )
        return {"llm_interpretation": text, "interpretation_source": "rule_based"}

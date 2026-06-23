"""
Trust Score Agent
=================
Computes a unified trust metric combining statistical confidence, 
safety verification, and sub-agent consensus.
"""

class TrustScoreAgent:
    """
    Combines model certainty, safety rules compliance, and consensus metrics 
    to output a single, clinical Trust Score between 0 and 100%.
    """

    def calculate_trust(self, confidence_score: float, safety_score: float, agreement_score: float) -> dict:
        """
        Calculate the trust score and categorize it.

        Args:
            confidence_score: Model confidence probability (0.0 to 1.0 or 0 to 100).
            safety_score: Score from SafetyVerificationAgent (0 to 100).
            agreement_score: Sub-agent consensus agreement score (0 to 100).

        Returns:
            Dict containing trust_score and trust_category.
        """
        # Normalize confidence to 0-100 scale if it is represented as a float in [0.0, 1.0]
        conf_scaled = confidence_score * 100.0 if confidence_score <= 1.0 else confidence_score
        
        # In case it is slightly over 100 due to input formatting
        conf_scaled = min(100.0, max(0.0, conf_scaled))
        
        # Calculate unified trust score
        trust_score = 0.4 * conf_scaled + 0.3 * safety_score + 0.3 * agreement_score
        trust_score = int(round(trust_score))
        trust_score = max(0, min(100, trust_score)) # Keep within logical boundaries
        
        # Determine Trust Category
        if trust_score >= 80:
            trust_category = "HIGH TRUST"
        elif trust_score >= 60:
            trust_category = "MODERATE TRUST"
        else:
            trust_category = "LOW TRUST"
            
        return {
            "trust_score": trust_score,
            "trust_category": trust_category
        }

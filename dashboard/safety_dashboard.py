"""
Safety Dashboard Provider
=========================
Exposes high-level clinical safety dashboard metrics for the frontend.
"""

from evaluation.safety_metrics import SafetyMetricsEvaluator
from typing import Dict, Any

class SafetyDashboardProvider:
    """
    Acts as the data provider layer for clinical safety evaluation dashboard queries.
    """

    @staticmethod
    def get_dashboard_metrics() -> Dict[str, Any]:
        """
        Calculates and formats all dashboard metrics for the reporting UI.
        """
        # Triggers evaluation calculations (which auto-seeds if necessary)
        metrics = SafetyMetricsEvaluator.calculate_metrics()
        return metrics

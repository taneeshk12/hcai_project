import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function EvaluationPage({ API_URL }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(`${API_URL}/api/evaluation/metrics`);
      setMetrics(res.data);
    } catch (err) {
      console.error('Error fetching safety metrics:', err);
      setError('Failed to load clinical safety evaluation metrics. Ensure backend server is online.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="page-container animate-fade-in" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="sonar-wave" style={{ margin: '0 auto 20px auto', width: '50px', height: '50px', backgroundColor: 'var(--primary)' }}></div>
          <p style={{ color: 'var(--text-muted)' }}>Calculating diagnostic performance and clinical safety audit metrics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container animate-fade-in">
        <div className="empty-state glass-panel" style={{ margin: 'auto', maxWidth: 600, borderLeft: '4px solid #ef4444' }}>
          <h2>Evaluation Load Failed</h2>
          <p>{error}</p>
          <button className="btn primary" onClick={fetchMetrics} style={{ marginTop: '15px' }}>Retry Calculations</button>
        </div>
      </div>
    );
  }

  const filteredLogs = metrics?.audit_logs?.filter(log => 
    log.patient_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.prediction.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.safety_status.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Clinical Safety & Performance Evaluation</h2>
          <p className="page-subtitle">Historical triage analytics, overrides tracking, and model validation stats.</p>
        </div>
        <button className="btn outline" onClick={fetchMetrics} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
          </svg>
          Re-Calculate Metrics
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '2rem' }}>
        <div className="glass-panel" style={{ padding: '20px', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Average Trust Score</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#10b981', margin: '10px 0 6px 0' }}>
            {metrics?.average_trust_score}%
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Unified safety & consensus score</div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', borderLeft: '4px solid #ef4444' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Unsafe Downgrade Rate</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#ef4444', margin: '10px 0 6px 0' }}>
            {(metrics?.unsafe_downgrade_rate * 100).toFixed(1)}%
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {metrics?.unsafe_downgrade_count} case{metrics?.unsafe_downgrade_count !== 1 ? 's' : ''} (True HIGH predicted LOW)
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Reviews Triggered</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#f59e0b', margin: '10px 0 6px 0' }}>
            {metrics?.human_reviews_triggered}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Mandatory clinician flags raised</div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Audited Cases</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#3b82f6', margin: '10px 0 6px 0' }}>
            {metrics?.total_cases}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Historical logs in database/CSV</div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', borderLeft: '4px solid #7c3aed' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Triage Mode Ratio</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#7c3aed', margin: '15px 0 6px 0', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span>🩺 {metrics?.immediate_triage_count || 0}</span>
            <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 400 }}>vs</span>
            <span>🧪 {metrics?.enhanced_triage_count || 0}</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Immediate vs. Enhanced cases
          </div>
        </div>
      </div>

      {/* Metrics Split Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px', marginBottom: '2rem' }}>
        {/* Diagnostic Performance Grid */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 700 }}>AI Classification Performance</h3>
          <p style={{ margin: '0 0 20px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Triage risk classification metrics calculated against final clinician overrides as ground truth.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div style={{ backgroundColor: 'var(--bg-card-hover)', padding: '15px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Accuracy</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text)', margin: '6px 0 2px 0' }}>{(metrics?.accuracy * 100).toFixed(1)}%</div>
              <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${metrics?.accuracy * 100}%`, height: '100%', backgroundColor: 'var(--primary)' }}></div>
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card-hover)', padding: '15px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Precision (High Risk)</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text)', margin: '6px 0 2px 0' }}>{(metrics?.precision * 100).toFixed(1)}%</div>
              <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${metrics?.precision * 100}%`, height: '100%', backgroundColor: '#10b981' }}></div>
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card-hover)', padding: '15px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Recall (High Risk)</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text)', margin: '6px 0 2px 0' }}>{(metrics?.recall * 100).toFixed(1)}%</div>
              <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${metrics?.recall * 100}%`, height: '100%', backgroundColor: '#3b82f6' }}></div>
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card-hover)', padding: '15px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>F1-Score (High Risk)</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text)', margin: '6px 0 2px 0' }}>{(metrics?.f1 * 100).toFixed(1)}%</div>
              <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${metrics?.f1 * 100}%`, height: '100%', backgroundColor: '#f59e0b' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Clinical Safety Verification Grid */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 700 }}>Clinical Safety Oversight Metrics</h3>
          <p style={{ margin: '0 0 20px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Validation of safety-rule compliance and dangerous triage failures (e.g. downgrades).
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Safety Rule Agreement Rate</span>
                <strong>{(metrics?.safety_agreement_rate * 100).toFixed(1)}%</strong>
              </div>
              <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${metrics?.safety_agreement_rate * 100}%`, height: '100%', backgroundColor: '#10b981' }}></div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Average Model Confidence</span>
                <strong>{(metrics?.average_confidence * 100).toFixed(1)}%</strong>
              </div>
              <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${metrics?.average_confidence * 100}%`, height: '100%', backgroundColor: '#3b82f6' }}></div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>False Negative High Risk Rate</span>
                <strong style={{ color: metrics?.false_negative_high_risk_rate > 0.05 ? '#ef4444' : 'var(--text)' }}>
                  {(metrics?.false_negative_high_risk_rate * 100).toFixed(1)}%
                </strong>
              </div>
              <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${metrics?.false_negative_high_risk_rate * 100}%`, height: '100%', backgroundColor: '#ef4444' }}></div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.04)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '10px 15px', borderRadius: '6px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: '1.2rem' }}>⚠️</span>
              <div>
                <strong>Continuous Learning Alert:</strong> Clinician feedback and overrides are recorded in <code>feedback_log.csv</code> to drive monthly model retraining via <code>retrain_general_model.py</code>.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Safety Audit Trail Logs */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Clinical Safety Audit Trail</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Real-time case metrics logged to safety_audit_log.csv.</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input 
              type="text" 
              placeholder="Search by ID, prediction or status..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="search-input"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.85rem',
                color: 'var(--text)',
                minWidth: '240px'
              }}
            />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="patients-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', opacity: 0.8 }}>
                <th style={{ padding: '12px' }}>Timestamp</th>
                <th style={{ padding: '12px' }}>Patient ID</th>
                <th style={{ padding: '12px' }}>Triage Mode</th>
                <th style={{ padding: '12px' }}>Risk Prediction</th>
                <th style={{ padding: '12px' }}>Confidence</th>
                <th style={{ padding: '12px' }}>Trust Score</th>
                <th style={{ padding: '12px' }}>Safety Verification</th>
                <th style={{ padding: '12px' }}>Human Review</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log, index) => {
                  const sColor = log.safety_status === 'AGREEMENT' ? '#10b981' : '#ef4444';
                  const rColor = log.human_review_required === 'YES' ? '#ef4444' : '#10b981';
                  const pColor = log.prediction.includes('HIGH') ? '#ef4444' : log.prediction.includes('MID') || log.prediction.includes('MEDIUM') ? '#f59e0b' : '#10b981';
                  const dt = new Date(log.timestamp);
                  
                  return (
                    <tr key={index} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.2s' }} className="table-row-hover">
                      <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                        {dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} {dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '12px', fontWeight: 600 }}>{log.patient_id}</td>
                      <td style={{ padding: '12px' }}>
                        {log.triage_mode && (
                          <span className={`triage-mode-badge ${log.triage_mode.toLowerCase()}`} style={{ margin: 0, padding: '2px 6px', fontSize: '0.7rem' }}>
                            {log.triage_mode === 'ENHANCED' ? '🧪 Enhanced' : '🩺 Immediate'}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ color: pColor, background: pColor + '10', border: `1px solid ${pColor}30`, padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                          {log.prediction}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>{log.confidence}</td>
                      <td style={{ padding: '12px', fontWeight: 600 }}>{log.trust_score}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ color: sColor, background: sColor + '10', border: `1px solid ${sColor}30`, padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                          {log.safety_status}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ color: rColor, fontWeight: 700 }}>{log.human_review_required}</span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No audit log cases found matching query.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

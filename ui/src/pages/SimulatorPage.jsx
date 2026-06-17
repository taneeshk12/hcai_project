import React, { useMemo, useRef, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';

const CLINICAL_RANGES = {
  spo2:             { min: 70,  max: 100,  step: 1    },
  respiratory_rate: { min: 5,   max: 50,   step: 1    },
  temperature:      { min: 34.0,max: 42.0, step: 0.1  },
  heart_rate:       { min: 30,  max: 200,  step: 1    },
  systolic_bp:      { min: 60,  max: 240,  step: 1    },
  diastolic_bp:     { min: 30,  max: 140,  step: 1    },
  wbc:              { min: 1.0, max: 50.0, step: 0.1  },
  hemoglobin:       { min: 5.0, max: 25.0, step: 0.1  },
  glucose:          { min: 20,  max: 600,  step: 5    },
  troponin:         { min: 0.0, max: 5.0,  step: 0.01 },
  lactate:          { min: 0.2, max: 20.0, step: 0.1  },
  creatinine:       { min: 0.1, max: 15.0, step: 0.1  },
};

const PARAM_LABELS = {
  spo2:             'SpO₂ (%)',
  respiratory_rate: 'Resp Rate (/min)',
  temperature:      'Temperature (°C)',
  heart_rate:       'Heart Rate (bpm)',
  systolic_bp:      'Systolic BP (mmHg)',
  diastolic_bp:     'Diastolic BP (mmHg)',
  wbc:              'WBC (k/µL)',
  hemoglobin:       'Hemoglobin (g/dL)',
  glucose:          'Glucose (mg/dL)',
  troponin:         'Troponin (ng/mL)',
  lactate:          'Lactate (mmol/L)',
  creatinine:       'Creatinine (mg/dL)',
};

// Normal reference ranges for each parameter
const NORMAL_RANGES = {
  spo2:             { low: 95,   high: 100  },
  respiratory_rate: { low: 12,   high: 20   },
  temperature:      { low: 36.5, high: 37.5 },
  heart_rate:       { low: 60,   high: 100  },
  systolic_bp:      { low: 90,   high: 140  },
  diastolic_bp:     { low: 60,   high: 90   },
  wbc:              { low: 4.5,  high: 11.0 },
  hemoglobin:       { low: 12.0, high: 17.5 },
  glucose:          { low: 70,   high: 140  },
  troponin:         { low: 0,    high: 0.04 },
  lactate:          { low: 0.5,  high: 2.0  },
  creatinine:       { low: 0.6,  high: 1.2  },
};

// Critical alarm thresholds
const CRITICAL_THRESHOLDS = {
  spo2:             { low: 90 },
  heart_rate:       { low: 40, high: 130 },
  systolic_bp:      { low: 90, high: 200 },
  respiratory_rate: { low: 8,  high: 30  },
};

function getVitalStatus(name, value) {
  const crit = CRITICAL_THRESHOLDS[name];
  if (crit) {
    if (crit.low !== undefined && value < crit.low) return 'critical';
    if (crit.high !== undefined && value > crit.high) return 'critical';
  }
  const norm = NORMAL_RANGES[name];
  if (norm) {
    // For spo2, lower is worse
    if (name === 'spo2') {
      if (value < 93) return 'warning';
      return 'normal';
    }
    if (value < norm.low || value > norm.high) return 'warning';
  }
  return 'normal';
}

function getRiskColor(risk) {
  if (!risk) return '#94a3b8';
  const r = risk.toUpperCase();
  if (r.includes('HIGH')) return '#ef4444';
  if (r.includes('MED') || r.includes('MID')) return '#f59e0b';
  return '#10b981';
}

function getOverallRiskPercent(aggregation) {
  if (!aggregation) return 0;
  const conf = aggregation.overall_confidence ?? 0.5;
  if (aggregation.final_risk === 'HIGH') return Math.round(75 + conf * 25);
  if (aggregation.final_risk === 'MEDIUM' || aggregation.final_risk === 'MID') return Math.round(35 + conf * 40);
  return Math.round(conf * 35);
}

// ────────────────────────────────────────────────────────────────────────────
// Mini Gauge SVG
// ────────────────────────────────────────────────────────────────────────────
function MiniGauge({ percent, color }) {
  const ARC_LEN = 220;
  const dash = Math.max(0, Math.min(1, percent / 100)) * ARC_LEN;
  return (
    <svg viewBox="0 0 120 70" width="120" height="70" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="simGaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
      </defs>
      <path d="M 10 62 A 50 50 0 0 1 110 62" stroke="rgba(255,255,255,0.07)" strokeWidth="10" fill="none" strokeLinecap="round" />
      <path d="M 10 62 A 50 50 0 0 1 110 62" stroke="url(#simGaugeGrad)" strokeWidth="10" fill="none" strokeLinecap="round"
        strokeDasharray={`${dash} ${ARC_LEN}`} style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      <text x="60" y="57" textAnchor="middle" fontSize="16" fontWeight="bold" fill={color}>{percent}%</text>
    </svg>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Slider component
// ────────────────────────────────────────────────────────────────────────────
function SimSlider({ name, label, unit, value, baselineValue, onChange, isSweepTarget, onSetSweep }) {
  const config = CLINICAL_RANGES[name];
  if (!config) return null;

  const status = getVitalStatus(name, value);
  const diff = baselineValue !== undefined ? value - baselineValue : 0;
  const hasDelta = Math.abs(diff) >= (config.step ?? 1) * 0.5;
  const isBetter = name === 'spo2' || name === 'hemoglobin' ? diff > 0 : diff < 0;
  const deltaLabel = hasDelta ? `${diff > 0 ? '+' : ''}${diff.toFixed(config.step % 1 === 0 ? 0 : 1)} ${unit}` : '';

  const statusColor = status === 'critical' ? '#ef4444' : status === 'warning' ? '#f59e0b' : '#10b981';
  const pct = ((value - config.min) / (config.max - config.min)) * 100;

  return (
    <div className={`sim-slider-group ${status !== 'normal' ? 'sim-slider-alert' : ''}`}>
      <div className="sim-slider-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="sim-slider-status-dot" style={{ background: statusColor, boxShadow: status !== 'normal' ? `0 0 6px ${statusColor}` : 'none' }} />
          <span className="sim-slider-label">{label}</span>
          {status === 'critical' && <span style={{ fontSize: '0.6rem', background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440', borderRadius: '4px', padding: '1px 5px', fontWeight: 700 }}>CRIT</span>}
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {hasDelta && (
            <span className={`delta-badge ${isBetter ? 'delta-good' : 'delta-bad'}`}>{deltaLabel}</span>
          )}
          <span className="sim-slider-value">
            {typeof value === 'number' ? value.toFixed(config.step % 1 === 0 ? 0 : 1) : value}
            <span style={{ opacity: 0.5, fontSize: '0.72rem', marginLeft: '2px' }}>{unit}</span>
          </span>
        </div>
      </div>

      <div className="sim-slider-track-wrapper">
        <div className="sim-slider-fill" style={{ width: `${pct}%`, background: `linear-gradient(90deg, #3b82f6, ${statusColor})` }} />
        <input
          type="range"
          name={name}
          min={config.min} max={config.max} step={config.step}
          value={value}
          onChange={e => onChange(name, parseFloat(e.target.value))}
          className="whatif-slider"
        />
      </div>

      <div className="sim-slider-footer">
        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', opacity: 0.6 }}>{config.min}{unit}</span>
        <button
          className={`sim-sweep-btn ${isSweepTarget ? 'active' : ''}`}
          onClick={() => onSetSweep(name)}
          title="Set as sensitivity sweep parameter"
        >
          {isSweepTarget ? '📈 Sweeping' : '📈 Sweep'}
        </button>
        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', opacity: 0.6 }}>{config.max}{unit}</span>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────────────
export default function SimulatorPage({
  predictions, aggregation, patientData, setPatientData,
  baselineData, setBaselineData,
  baselinePredictions, setBaselinePredictions,
  baselineAggregation, setBaselineAggregation,
  isWhatIfMode, setIsWhatIfMode,
  sensitivityData, setSensitivityData,
  sensitivityParam, setSensitivityParam,
  insightsTab, setInsightsTab,
  debouncedPredict, debouncedSweep, runSensitivitySweep,
  loading, setLoading, setError,
  patientName, currentPatientId,
  API_URL, axios,
  setPredictions, setAggregation, setLlmSummary, setFullReport, setFeedbackStatus,
}) {
  // ── Guard ────────────────────────────────────────────────────────────────
  if (!predictions) {
    return (
      <div className="page-container animate-fade-in">
        <div className="empty-state glass-panel" style={{ margin: 'auto', maxWidth: 600 }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎛️</div>
          <h2>Simulator Not Available</h2>
          <p>Please complete a <strong>Triage Intake</strong> analysis first, then return here to explore what-if scenarios.</p>
        </div>
      </div>
    );
  }

  // ── Simulation handlers ──────────────────────────────────────────────────
  const handleEnterSim = () => {
    setBaselineData({ ...patientData });
    setBaselinePredictions(predictions);
    setBaselineAggregation(aggregation);
    runSensitivitySweep(patientData, sensitivityParam);
    setIsWhatIfMode(true);
  };

  const handleExitSim = () => {
    const restoredData = { ...baselineData };
    setPatientData(restoredData);
    setBaselineData(null);
    setBaselinePredictions(null);
    setBaselineAggregation(null);
    setSensitivityData([]);
    setIsWhatIfMode(false);
    setLoading(true);
    setError(null);
    axios.post(`${API_URL}/hcai/analyze`, {
      ...restoredData,
      patient_id: currentPatientId,
      patient_name: patientName.trim() || 'Anonymous',
    }).then(res => {
      if (res.data.status === 'success') {
        setPredictions(res.data.predictions);
        setAggregation(res.data.aggregation);
        setLlmSummary(res.data.hcai_report?.llm_interpretation || null);
        setFullReport(res.data.hcai_report || null);
        setFeedbackStatus(null);
      }
    }).catch(err => console.error('Restore error:', err))
      .finally(() => setLoading(false));
  };

  // ── Slider change ────────────────────────────────────────
  const handleSliderChange = (name, val) => {
    const updated = { ...patientData, [name]: val };
    setPatientData(updated);
    // Fast update: predict risk in ~400 ms after user pauses
    debouncedPredict(updated);
    // Slow update: batch sweep fires 1.5s after user stops dragging
    debouncedSweep(updated, sensitivityParam);
  };

  // ── Set sweep param ──────────────────────────────────────────────────────
  const handleSetSweepParam = (name) => {
    setSensitivityParam(name);
    runSensitivitySweep(patientData, name);
    setInsightsTab('sensitivity');
  };

  // ── Quick presets ────────────────────────────────────────────────────────
  const applyPreset = (type) => {
    let updated;
    if (type === 'deteriorate') {
      updated = {
        ...patientData,
        spo2: Math.max(70, patientData.spo2 - 8),
        heart_rate: Math.min(200, patientData.heart_rate + 30),
        systolic_bp: Math.max(60, patientData.systolic_bp - 30),
        respiratory_rate: Math.min(50, patientData.respiratory_rate + 10),
        lactate: Math.min(20, patientData.lactate + 2.0),
        troponin: Math.min(5, patientData.troponin + 0.3),
      };
    } else {
      updated = {
        ...patientData,
        spo2: Math.min(100, patientData.spo2 + 5),
        heart_rate: Math.max(60, Math.min(85, patientData.heart_rate - 20)),
        systolic_bp: Math.min(130, Math.max(110, patientData.systolic_bp + 15)),
        respiratory_rate: Math.max(12, patientData.respiratory_rate - 6),
        lactate: Math.max(0.5, patientData.lactate - 1.0),
        troponin: Math.max(0, patientData.troponin - 0.1),
      };
    }
    setPatientData(updated);
    debouncedPredict(updated);
    runSensitivitySweep(updated, sensitivityParam);
  };

  // ── Derived data ─────────────────────────────────────────────────────────
  const riskPercent = getOverallRiskPercent(aggregation);
  const baselineRiskPercent = getOverallRiskPercent(baselineAggregation);
  const riskColor = getRiskColor(aggregation?.final_risk);
  const baselineColor = getRiskColor(baselineAggregation?.final_risk);

  const criticalAlerts = useMemo(() => {
    if (!isWhatIfMode) return [];
    return Object.entries(CRITICAL_THRESHOLDS).flatMap(([name, thresholds]) => {
      const val = patientData[name];
      if (val === undefined) return [];
      const alerts = [];
      if (thresholds.low !== undefined && val < thresholds.low)
        alerts.push({ name: PARAM_LABELS[name] || name, val, threshold: thresholds.low, dir: 'below' });
      if (thresholds.high !== undefined && val > thresholds.high)
        alerts.push({ name: PARAM_LABELS[name] || name, val, threshold: thresholds.high, dir: 'above' });
      return alerts;
    });
  }, [isWhatIfMode, patientData]);

  const changedVitals = useMemo(() => {
    if (!baselineData) return [];
    return Object.entries(PARAM_LABELS)
      .filter(([k]) => {
        const diff = (patientData[k] ?? 0) - (baselineData[k] ?? 0);
        const step = CLINICAL_RANGES[k]?.step ?? 1;
        return Math.abs(diff) >= step * 0.9;
      })
      .map(([k, label]) => {
        const diff = patientData[k] - baselineData[k];
        return { key: k, label, diff, unit: label.match(/\(([^)]+)\)/)?.[1] ?? '' };
      });
  }, [patientData, baselineData]);

  const riskShiftData = useMemo(() => {
    if (!baselinePredictions || !predictions) return [];
    const getHighProb = (ag) => {
      if (!ag || ag.status === 'error') return 0;
      const p = ag.probabilities;
      if (!p) return 0;
      return Math.round((p.high ?? p.high_risk ?? 0) * 100);
    };
    return [
      { name: 'Respiratory', Baseline: getHighProb(baselinePredictions.respiratory), Simulated: getHighProb(predictions.respiratory) },
      { name: 'Cardiac',     Baseline: getHighProb(baselinePredictions.cardiac),     Simulated: getHighProb(predictions.cardiac) },
      { name: 'Sepsis',      Baseline: getHighProb(baselinePredictions.sepsis),       Simulated: getHighProb(predictions.sepsis) },
      { name: 'General',     Baseline: getHighProb(baselinePredictions.general),      Simulated: getHighProb(predictions.general) },
    ];
  }, [baselinePredictions, predictions]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="page-container animate-fade-in">
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h2 className="page-title">What-If Simulator</h2>
          <p className="page-subtitle">Adjust vitals in real-time and observe how all 4 ML models respond.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {isWhatIfMode && (
            <>
              <button className="btn outline sim-preset-btn deteriorate" onClick={() => applyPreset('deteriorate')}>
                📉 Deteriorate
              </button>
              <button className="btn outline sim-preset-btn improve" onClick={() => applyPreset('improve')}>
                📈 Improve
              </button>
            </>
          )}
          {!isWhatIfMode ? (
            <button className="btn primary" onClick={handleEnterSim} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Enter Simulation
            </button>
          ) : (
            <button className="btn outline" onClick={handleExitSim} style={{ borderColor: '#ef4444', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Exit &amp; Restore
            </button>
          )}
        </div>
      </div>

      {!isWhatIfMode ? (
        <div className="sim-inactive-prompt glass-panel">
          <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.7 }}>🎛️</div>
          <h3>Ready to Simulate</h3>
          <p>Click <strong>Enter Simulation</strong> to start adjusting vitals and observe real-time risk shifts. The current patient state is saved as a baseline and fully restored on exit.</p>
        </div>
      ) : (
        <div className="sim-active-layout">

          {/* ── LEFT: Sliders ── */}
          <div className="sim-sliders-panel glass-panel">
            <div className="sim-panel-title">
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none"><circle cx="12" cy="12" r="3"/><line x1="3" y1="12" x2="9" y2="12"/><line x1="15" y1="12" x2="21" y2="12"/><line x1="12" y1="3" x2="12" y2="9"/><line x1="12" y1="15" x2="12" y2="21"/></svg>
              Adjust Vitals
              {loading && <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: '#60a5fa', animation: 'pulse 1s infinite' }}>updating…</span>}
            </div>

            {/* Live risk score widget */}
            <div className="sim-live-risk-card">
              <div className="sim-live-risk-col baseline">
                <div className="sim-live-risk-label">Baseline</div>
                <MiniGauge percent={baselineRiskPercent} color={baselineColor} />
                <div className="sim-live-risk-badge" style={{ color: baselineColor, borderColor: baselineColor + '40', background: baselineColor + '18' }}>
                  {baselineAggregation?.final_risk ?? '—'}
                </div>
                <div className="sim-live-conf">
                  conf {((baselineAggregation?.overall_confidence ?? 0) * 100).toFixed(0)}%
                </div>
              </div>

              <div className="sim-live-arrow">
                <div className="sim-risk-delta" style={{ color: riskPercent > baselineRiskPercent ? '#ef4444' : '#10b981' }}>
                  {riskPercent > baselineRiskPercent ? '▲' : riskPercent < baselineRiskPercent ? '▼' : '—'}
                  {' '}{Math.abs(riskPercent - baselineRiskPercent)}%
                </div>
              </div>

              <div className="sim-live-risk-col simulated">
                <div className="sim-live-risk-label">Simulated</div>
                <MiniGauge percent={riskPercent} color={riskColor} />
                <div className="sim-live-risk-badge" style={{ color: riskColor, borderColor: riskColor + '40', background: riskColor + '18' }}>
                  {aggregation?.final_risk ?? '—'}
                </div>
                <div className="sim-live-conf">
                  conf {((aggregation?.overall_confidence ?? 0) * 100).toFixed(0)}%
                </div>
              </div>
            </div>

            {/* Critical alerts */}
            {criticalAlerts.length > 0 && (
              <div className="sim-critical-alerts">
                {criticalAlerts.map((a, i) => (
                  <div key={i} className="sim-crit-alert-row">
                    <span>🚨</span>
                    <span><strong>{a.name}</strong> {a.val} is {a.dir} critical threshold ({a.threshold})</span>
                  </div>
                ))}
              </div>
            )}

            {/* Changed vitals summary */}
            {changedVitals.length > 0 && (
              <div className="sim-changes-summary">
                <div className="sim-changes-title">Changes from Baseline</div>
                {changedVitals.map(v => {
                  const isBetter = v.key === 'spo2' || v.key === 'hemoglobin' ? v.diff > 0 : v.diff < 0;
                  return (
                    <div key={v.key} className="sim-change-row">
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{v.label.split('(')[0].trim()}</span>
                      <span className={`delta-badge ${isBetter ? 'delta-good' : 'delta-bad'}`}>
                        {v.diff > 0 ? '+' : ''}{v.diff.toFixed(CLINICAL_RANGES[v.key]?.step % 1 === 0 ? 0 : 1)} {v.unit}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Sliders */}
            <div className="sim-sliders-grid">
              {[
                ['SpO₂',          'spo2',             '%'],
                ['Resp Rate',     'respiratory_rate', '/min'],
                ['Heart Rate',    'heart_rate',       'bpm'],
                ['Systolic BP',   'systolic_bp',      'mmHg'],
                ['Temperature',   'temperature',      '°C'],
                ['WBC',           'wbc',              'k/µL'],
                ['Lactate',       'lactate',          'mmol/L'],
                ['Troponin',      'troponin',         'ng/mL'],
                ['Glucose',       'glucose',          'mg/dL'],
              ].map(([label, key, unit]) => (
                <SimSlider
                  key={key}
                  name={key}
                  label={label}
                  unit={unit}
                  value={patientData[key] ?? 0}
                  baselineValue={baselineData?.[key]}
                  onChange={handleSliderChange}
                  isSweepTarget={sensitivityParam === key}
                  onSetSweep={handleSetSweepParam}
                />
              ))}
            </div>
          </div>

          {/* ── RIGHT: Charts ── */}
          <div className="sim-charts-panel">

            {/* Tab nav */}
            <div className="tab-navigation" style={{ marginBottom: '1rem' }}>
              <button className={`tab-btn ${insightsTab === 'subsystem' ? 'active' : ''}`} onClick={() => setInsightsTab('subsystem')} type="button">
                <span>Risk Shift</span>
              </button>
              <button className={`tab-btn ${insightsTab === 'sensitivity' ? 'active' : ''}`} onClick={() => setInsightsTab('sensitivity')} type="button">
                <span>Sensitivity Curve</span>
              </button>
              <button className={`tab-btn ${insightsTab === 'agents' ? 'active' : ''}`} onClick={() => setInsightsTab('agents')} type="button">
                <span>Agent Scores</span>
              </button>
            </div>

            {/* ── Risk Shift bar chart ── */}
            {insightsTab === 'subsystem' && (
              <div className="glass-panel sim-chart-card animate-fade-in">
                <div className="sim-chart-title">Sub-System High-Risk Probability: Baseline vs Simulated</div>
                {riskShiftData.every(d => d.Baseline === 0 && d.Simulated === 0) ? (
                  <div className="sim-no-data">All agents show low risk. Try deteriorating vitals to see the shift.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={riskShiftData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                      <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} unit="%" />
                      <Tooltip
                        contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }}
                        formatter={(v, name) => [`${v}%`, name]}
                      />
                      <Legend wrapperStyle={{ color: 'var(--text-muted)', fontSize: '12px' }} />
                      <Bar dataKey="Baseline" fill="#334155" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Simulated" radius={[4, 4, 0, 0]}>
                        {riskShiftData.map((entry, idx) => {
                          const diff = entry.Simulated - entry.Baseline;
                          const fill = diff > 5 ? '#ef4444' : diff < -5 ? '#10b981' : '#3b82f6';
                          return <Cell key={idx} fill={fill} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
                <div className="sim-chart-legend-note">
                  <span style={{ color: '#10b981' }}>■ Green</span> = risk decreased &nbsp;
                  <span style={{ color: '#ef4444' }}>■ Red</span> = risk increased &nbsp;
                  <span style={{ color: '#3b82f6' }}>■ Blue</span> = minimal change
                </div>
              </div>
            )}

            {/* ── Sensitivity curve ── */}
            {insightsTab === 'sensitivity' && (
              <div className="glass-panel sim-chart-card animate-fade-in">
                <div className="sim-chart-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <span>Sensitivity Curve — How risk responds to <em>{PARAM_LABELS[sensitivityParam]}</em></span>
                  <select
                    value={sensitivityParam}
                    onChange={e => { setSensitivityParam(e.target.value); runSensitivitySweep(patientData, e.target.value); }}
                    style={{ fontSize: '0.8rem', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'inherit', cursor: 'pointer' }}
                  >
                    {Object.entries(PARAM_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                {sensitivityData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart data={sensitivityData} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
                        <defs>
                          <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                        <XAxis
                          dataKey="val"
                          type="number"
                          domain={[CLINICAL_RANGES[sensitivityParam].min, CLINICAL_RANGES[sensitivityParam].max]}
                          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                          label={{ value: PARAM_LABELS[sensitivityParam], fill: 'var(--text-muted)', fontSize: 11, position: 'insideBottom', offset: -20 }}
                          height={50}
                        />
                        <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} unit="%" />
                        <Tooltip
                          contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }}
                          formatter={v => [`${v}%`, 'Overall Risk']}
                          labelFormatter={v => `${PARAM_LABELS[sensitivityParam].split('(')[0].trim()}: ${v}`}
                        />
                        <ReferenceLine y={50} stroke="rgba(245,158,11,0.4)" strokeDasharray="4 4" label={{ value: 'MED', fill: '#f59e0b', fontSize: 9, position: 'right' }} />
                        <ReferenceLine y={75} stroke="rgba(239,68,68,0.4)" strokeDasharray="4 4" label={{ value: 'HIGH', fill: '#ef4444', fontSize: 9, position: 'right' }} />
                        <Area type="monotone" dataKey="risk" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRisk)" dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }} />
                        <ReferenceLine
                          x={patientData[sensitivityParam]}
                          stroke="#ef4444"
                          strokeWidth={2}
                          strokeDasharray="4 3"
                          label={{ value: 'NOW', fill: '#ef4444', fontSize: 9, position: 'top' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                    <div className="sim-sensitivity-note">
                      The dashed red line shows the patient's current value. The horizontal lines show risk category boundaries (50% = Medium, 75% = High).
                    </div>
                  </>
                ) : (
                  <div className="sim-no-data">
                    <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>⏳</div>
                    Loading sensitivity data — please wait a moment…
                  </div>
                )}
              </div>
            )}

            {/* ── Agent Score Breakdown ── */}
            {insightsTab === 'agents' && (
              <div className="glass-panel sim-chart-card animate-fade-in">
                <div className="sim-chart-title">Live Agent Risk Probabilities</div>
                <div className="sim-agent-breakdown">
                  {[
                    { key: 'respiratory', label: 'Respiratory', icon: '🫁' },
                    { key: 'cardiac',     label: 'Cardiac',     icon: '❤️' },
                    { key: 'sepsis',      label: 'Sepsis',      icon: '🦠' },
                    { key: 'general',     label: 'General',     icon: '🛡️' },
                  ].map(({ key, label, icon }) => {
                    const cur = predictions?.[key];
                    const base = baselinePredictions?.[key];
                    if (!cur || cur.status === 'error') return (
                      <div key={key} className="sim-agent-row error">
                        <span>{icon} {label}</span>
                        <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>unavailable</span>
                      </div>
                    );
                    const p = cur.probabilities ?? {};
                    const low    = (p.low    ?? p.low_risk    ?? 0) * 100;
                    const medium = (p.medium ?? p.mid_risk    ?? 0) * 100;
                    const high   = (p.high   ?? p.high_risk   ?? 0) * 100;
                    const bp = base?.probabilities ?? {};
                    const baseHigh = (bp.high ?? bp.high_risk ?? 0) * 100;
                    const delta = high - baseHigh;
                    const riskColor = getRiskColor(cur.risk_level);
                    return (
                      <div key={key} className="sim-agent-row">
                        <div className="sim-agent-row-header">
                          <span className="sim-agent-icon">{icon}</span>
                          <span className="sim-agent-name">{label}</span>
                          <span className="sim-agent-risk" style={{ color: riskColor }}>{cur.risk_level?.replace(/_?RISK/i, '').replace(/_/g, ' ')}</span>
                          {Math.abs(delta) > 1 && (
                            <span className={`delta-badge ${delta > 0 ? 'delta-bad' : 'delta-good'}`}>
                              {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(0)}%
                            </span>
                          )}
                          <span className="sim-agent-conf">{(cur.confidence * 100).toFixed(0)}% conf</span>
                        </div>
                        <div className="sim-agent-prob-bar">
                          <div style={{ width: `${low}%`, background: '#10b981', height: '100%', borderRadius: '3px 0 0 3px', transition: 'width 0.5s ease' }} title={`Low: ${low.toFixed(0)}%`} />
                          <div style={{ width: `${medium}%`, background: '#f59e0b', height: '100%', transition: 'width 0.5s ease' }} title={`Medium: ${medium.toFixed(0)}%`} />
                          <div style={{ width: `${high}%`, background: '#ef4444', height: '100%', borderRadius: '0 3px 3px 0', transition: 'width 0.5s ease' }} title={`High: ${high.toFixed(0)}%`} />
                        </div>
                        <div className="sim-agent-prob-labels">
                          <span style={{ color: '#10b981' }}>L {low.toFixed(0)}%</span>
                          <span style={{ color: '#f59e0b' }}>M {medium.toFixed(0)}%</span>
                          <span style={{ color: '#ef4444' }}>H {high.toFixed(0)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>{/* end sim-charts-panel */}
        </div>
      )}
    </div>
  );
}

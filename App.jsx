import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip } from 'recharts';
import './App.css';

const API_URL = 'http://localhost:8000';

// Custom Aesthetic SVG Icons
const HeartPulseIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="icon-svg pulsing-icon">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
);

const LungsIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="icon-svg">
    <path d="M12 4v16M12 7c-2.5-3-7-3-9 0v7c2.2 3 6.8 3 9 0M12 7c2.5-3 7-3 9 0v7c-2.2 3-6.8 3-9 0" />
    <path d="M5 14c1-1 2-1 3 0M16 14c1-1 2-1 3 0" />
  </svg>
);

const MicrobeIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="icon-svg">
    <circle cx="12" cy="12" r="9" />
    <circle cx="8" cy="9" r="1.5" fill="currentColor" />
    <circle cx="14" cy="8" r="1" fill="currentColor" />
    <circle cx="15" cy="13" r="1.5" fill="currentColor" />
    <circle cx="10" cy="15" r="1" fill="currentColor" />
    <path d="M12 3a9 9 0 0 1 0 18" strokeDasharray="2 2" />
  </svg>
);

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="icon-svg">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);

const SirenIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="siren-icon">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const SunIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const HeartbeatRateIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
);

function App() {
  const [patientData, setPatientData] = useState({
    // Demographics
    age: 45,
    sex: 'M',
    age_group: 'adult',
    altered_mentation: 0,
    chest_pain: 0,
    diabetes: 0,
    // Vitals
    spo2: 97,
    respiratory_rate: 16,
    temperature: 36.8,
    heart_rate: 70,
    systolic_bp: 120,
    diastolic_bp: 80,
    pain_score: 2,
    // Labs
    wbc: 7.5,
    hemoglobin: 14.0,
    platelet_count: 250,
    sodium: 140,
    potassium: 4.0,
    creatinine: 0.9,
    glucose: 100,
    troponin: 0.01,
    bnp: 50,
    lactate: 1.2,
    inr: 1.0,
  });

  const [predictions, setPredictions] = useState(null);
  const [aggregation, setAggregation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [apiStatus, setApiStatus] = useState(false);
  const [isLightMode, setIsLightMode] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState(null);
  const [overrideValue, setOverrideValue] = useState('MEDIUM');
  const [activeTab, setActiveTab] = useState('demographics'); // 'demographics' | 'vitals' | 'labs'

  useEffect(() => {
    checkApiHealth();
    const interval = setInterval(checkApiHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isLightMode) {
      document.body.setAttribute('data-theme', 'light');
    } else {
      document.body.removeAttribute('data-theme');
    }
  }, [isLightMode]);

  // Auto-calculate pain score and age group based on clinical triage heuristics
  const hr = patientData.heart_rate;
  const sbp = patientData.systolic_bp;
  const spo2 = patientData.spo2;
  const temp = patientData.temperature;
  const mentation = patientData.altered_mentation;
  const age = patientData.age;

  useEffect(() => {
    let score = 0;
    if (mentation === 1) {
      score = 0; // In comatose or severely altered patients, self-reported pain score is default 0 in triage
    } else {
      // Vital sign clinical stress index approximation for subjective pain
      if (hr > 110) score += 3;
      else if (hr > 90) score += 1;
      
      if (sbp > 160 || sbp < 90) score += 3;
      else if (sbp > 140 || sbp < 100) score += 1;
      
      if (spo2 < 90) score += 3;
      else if (spo2 < 93) score += 1;
      
      if (temp > 38.5 || temp < 36.0) score += 1;
    }
    
    let ageGrp = 'adult';
    if (age < 18) ageGrp = 'pediatric';
    else if (age < 65) ageGrp = 'adult';
    else if (age < 80) ageGrp = 'senior';
    else ageGrp = 'elderly';

    setPatientData(prev => {
      if (prev.pain_score === score && prev.age_group === ageGrp) return prev;
      return {
        ...prev,
        pain_score: score,
        age_group: ageGrp
      };
    });
  }, [age, hr, sbp, spo2, temp, mentation]);

  const checkApiHealth = async () => {
    try {
      const response = await axios.get(`${API_URL}/health`);
      setApiStatus(response.data.status === 'healthy');
    } catch (err) {
      setApiStatus(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setPatientData(prev => ({
      ...prev,
      [name]: isNaN(value) ? value : parseFloat(value)
    }));
  };

  const handlePredict = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_URL}/unified/predict`, patientData);
      if (response.data.status === 'success') {
        setPredictions(response.data.predictions);
        setAggregation(response.data.aggregation);
        setFeedbackStatus(null);
      } else {
        setError(response.data.error || 'Prediction failed');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Connection error. Is the API running?');
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (action) => {
    try {
      setFeedbackStatus('submitting');
      const payload = {
        patient_data: patientData,
        ai_final_risk: aggregation?.final_risk,
        clinician_override: action === 'override' ? overrideValue : aggregation?.final_risk,
        action: action
      };
      await axios.post(`${API_URL}/feedback`, payload);
      setFeedbackStatus('success');
    } catch (err) {
      setFeedbackStatus('error');
    }
  };

  const loadHealthyExample = () => {
    setPatientData({
      age: 35, sex: 'M', age_group: 'adult', altered_mentation: 0, chest_pain: 0, diabetes: 0,
      spo2: 98, respiratory_rate: 14, temperature: 36.6, heart_rate: 65, systolic_bp: 115, diastolic_bp: 75, pain_score: 0,
      wbc: 6.0, hemoglobin: 15.0, platelet_count: 280, sodium: 140, potassium: 4.2, creatinine: 0.8, glucose: 90, troponin: 0.00, bnp: 20, lactate: 1.0, inr: 1.0
    });
    setPredictions(null);
    setAggregation(null);
    setFeedbackStatus(null);
  };

  const loadHighRiskExample = () => {
    setPatientData({
      age: 72, sex: 'F', age_group: 'senior', altered_mentation: 1, chest_pain: 1, diabetes: 1,
      spo2: 88, respiratory_rate: 30, temperature: 39.5, heart_rate: 120, systolic_bp: 85, diastolic_bp: 50, pain_score: 8,
      wbc: 18.0, hemoglobin: 10.0, platelet_count: 90, sodium: 130, potassium: 5.5, creatinine: 2.5, glucose: 250, troponin: 0.8, bnp: 800, lactate: 4.5, inr: 2.1
    });
    setPredictions(null);
    setAggregation(null);
    setFeedbackStatus(null);
  };

  const getRiskColor = (riskLevel) => {
    if (!riskLevel) return '#94a3b8';
    if (riskLevel.includes('LOW')) return '#10b981'; // Emerald
    if (riskLevel.includes('MEDIUM') || riskLevel.includes('MID')) return '#f59e0b'; // Amber
    if (riskLevel.includes('HIGH')) return '#ef4444'; // Red
    return '#94a3b8';
  };

  const processVitalsForRadar = () => {
    const safeCalc = (val, normal, critical) => {
      let percent = 50 + ((val - normal) / (critical - normal)) * 50;
      return Math.max(0, Math.min(100, percent));
    };
    
    return [
      { subject: 'Heart Rate', A: safeCalc(patientData.heart_rate, 75, 120), fullMark: 100, original: `${patientData.heart_rate} bpm` },
      { subject: 'Resp Rate', A: safeCalc(patientData.respiratory_rate, 16, 30), fullMark: 100, original: `${patientData.respiratory_rate} /min` },
      { subject: 'SpO2 (Inv)', A: safeCalc(100 - patientData.spo2, 2, 10), fullMark: 100, original: `${patientData.spo2} %` },
      { subject: 'Temp', A: safeCalc(patientData.temperature, 37.0, 39.5), fullMark: 100, original: `${patientData.temperature} °C` },
      { subject: 'Systolic BP', A: safeCalc(patientData.systolic_bp, 120, 180), fullMark: 100, original: `${patientData.systolic_bp} mmHg` },
    ];
  };

  const CustomRadarTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="radar-tooltip">
          <p className="tooltip-label">{data.subject}</p>
          <p className="tooltip-value">Clinical Value: <strong>{data.original}</strong></p>
          <p className="tooltip-normalized">Aggregated Risk Index: {Math.round(data.A)}/100</p>
        </div>
      );
    }
    return null;
  };

  const renderInput = (label, name, value, type = 'number', unit = '', range = '', options = null, disabled = false) => {
    return (
      <div className="input-group">
        <div className="input-header">
          <label>{label}</label>
          {range && <span className="input-range">{range}</span>}
        </div>
        <div className="input-control-wrapper">
          {options ? (
            <select name={name} value={value} onChange={handleInputChange} disabled={disabled}>
              {options.map(opt => <option key={opt.val} value={opt.val}>{opt.lbl}</option>)}
            </select>
          ) : (
            <>
              <input 
                type={type} 
                name={name} 
                value={value} 
                onChange={handleInputChange} 
                disabled={disabled}
                step={name === 'temperature' ? '0.1' : ['wbc', 'hemoglobin', 'potassium', 'creatinine', 'lactate', 'inr'].includes(name) ? '0.1' : name === 'troponin' ? '0.01' : '1'} 
              />
              {unit && <span className="input-unit">{unit}</span>}
            </>
          )}
        </div>
      </div>
    );
  };

  const renderCard = (title, modelKey, data) => {
    if (!data) return null;
    if (data.status === 'error') {
      return (
        <div className="prediction-card error-card">
          <div className="card-header">
            <h3>{title}</h3>
            <span className="error-icon">⚠️</span>
          </div>
          <p className="error-desc">Assessment Failed: {data.error_message}</p>
        </div>
      );
    }
    const color = getRiskColor(data.risk_level);
    
    // Normalize probability keys: handles both 'low/medium/high' and 'low_risk/mid_risk/high_risk'
    const probs = data.probabilities ? {
      low: data.probabilities.low ?? data.probabilities.low_risk ?? 0,
      medium: data.probabilities.medium ?? data.probabilities.mid_risk ?? 0,
      high: data.probabilities.high ?? data.probabilities.high_risk ?? 0
    } : null;
    
    // Choose appropriate SVG Icon
    let AgentIcon = ShieldIcon;
    if (modelKey === 'respiratory') AgentIcon = LungsIcon;
    else if (modelKey === 'cardiac') AgentIcon = HeartPulseIcon;
    else if (modelKey === 'sepsis') AgentIcon = MicrobeIcon;

    return (
      <div className="prediction-card" style={{ '--card-color': color }}>
        <div className="card-header">
          <div className="card-title-group">
            <span className="card-icon-container" style={{ color: color }}>
              <AgentIcon />
            </span>
            <h3>{title}</h3>
          </div>
          <div className="risk-badge" style={{ borderColor: color, color: color, backgroundColor: color + '15' }}>
            {data.risk_level.replace('_RISK', '')}
          </div>
        </div>
        
        <div className="card-body">
          {/* Custom Aesthetic Confidence Gauge */}
          <div className="confidence-meter-container">
            <div className="confidence-header">
              <span>Agent Confidence</span>
              <span className="confidence-value" style={{ color: color }}>{(data.confidence * 100).toFixed(1)}%</span>
            </div>
            <div className="confidence-bar-wrapper">
              <div className="confidence-bar-fill" style={{ width: `${data.confidence * 100}%`, backgroundColor: color }}>
                <span className="confidence-pulse-dot" style={{ backgroundColor: color }}></span>
              </div>
            </div>
          </div>

          <div className="action-text">
            <span className="action-label">Recommendation:</span>
            <p>{data.clinical_action}</p>
          </div>

          <div className="probabilities-section">
            <span className="section-small-title">Risk Distribution</span>
            <div className="probabilities-bar">
              {probs && (
                <>
                  <div className="prob-segment" style={{ width: `${probs.low * 100}%`, backgroundColor: '#10b981' }}></div>
                  <div className="prob-segment" style={{ width: `${probs.medium * 100}%`, backgroundColor: '#f59e0b' }}></div>
                  <div className="prob-segment" style={{ width: `${probs.high * 100}%`, backgroundColor: '#ef4444' }}></div>
                </>
              )}
            </div>
            <div className="probabilities-labels">
              <span>L: {((probs?.low || 0)*100).toFixed(0)}%</span>
              <span>M: {((probs?.medium || 0)*100).toFixed(0)}%</span>
              <span>H: {((probs?.high || 0)*100).toFixed(0)}%</span>
            </div>
          </div>

          <div className="shap-section">
            <h4 className="shap-title">Key Clinical Drivers</h4>
            {data.top_contributing_features && data.top_contributing_features.length > 0 ? (
              <div className="shap-bars">
                {data.top_contributing_features.map((feat, idx) => {
                  const maxVal = Math.max(...data.top_contributing_features.map(f => Math.abs(f.value)), 0.001);
                  const percentage = Math.min(100, Math.max(10, (Math.abs(feat.value) / maxVal) * 100));
                  const isPositive = feat.impact === 'positive';
                  
                  return (
                    <div key={idx} className="shap-row-modern">
                      <div className="shap-label-row">
                        <span className="shap-feat-name">{feat.feature.replace(/_/g, ' ')}</span>
                        <span className={`shap-feat-impact-tag ${isPositive ? 'positive' : 'negative'}`}>
                          {isPositive ? '↑' : '↓'} {Math.abs(feat.value).toFixed(2)}
                        </span>
                      </div>
                      <div className="shap-track-modern">
                        <div 
                          className={`shap-fill-modern ${isPositive ? 'risk-up' : 'risk-down'}`} 
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="shap-empty">Baseline values detected</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="app">
      <div className="glow-bg"></div>
      
      <header className="header">
        <div className="header-content">
          <div className="header-top-row">
            <div className="logo-section">
              <div className="pulse-circle">
                <HeartbeatRateIcon />
              </div>
              <div>
                <h1>OmniHealth Diagnostics</h1>
                <p className="subtitle">Clinical Multi-Agent Decision Engine</p>
              </div>
            </div>
            
            <div className="header-controls">
              <div className={`api-status ${apiStatus ? 'connected' : 'disconnected'}`}>
                <span className="status-dot"></span>
                <span>{apiStatus ? 'Core Engine Active' : 'Core Engine Offline'}</span>
              </div>
              
              <button className="theme-toggle" onClick={() => setIsLightMode(!isLightMode)} title="Toggle Visual Style">
                {isLightMode ? <MoonIcon /> : <SunIcon />}
                <span>{isLightMode ? 'Dark Terminal' : 'Clinical Light'}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="main-container">
        
        {/* Left Column: Form Intake Panel */}
        <section className="input-section glass-panel">
          <div className="section-header">
            <div className="section-title-group">
              <h2>Patient Parameters</h2>
              <span className="badge-clinical">Triage Intake</span>
            </div>
            
            <div className="presets-group">
              <button className="btn outline preset-btn" onClick={loadHealthyExample}>
                <span>Healthy Preset</span>
              </button>
              <button className="btn outline preset-btn critical" onClick={loadHighRiskExample}>
                <span>Critical Preset</span>
              </button>
            </div>
          </div>

          {/* Form Tabs Nav */}
          <div className="tab-navigation">
            <button 
              className={`tab-btn ${activeTab === 'demographics' ? 'active' : ''}`}
              onClick={() => setActiveTab('demographics')}
              type="button"
            >
              <span>Demographics</span>
            </button>
            <button 
              className={`tab-btn ${activeTab === 'vitals' ? 'active' : ''}`}
              onClick={() => setActiveTab('vitals')}
              type="button"
            >
              <span>Vitals & SpO₂</span>
            </button>
            <button 
              className={`tab-btn ${activeTab === 'labs' ? 'active' : ''}`}
              onClick={() => setActiveTab('labs')}
              type="button"
            >
              <span>Lab Reports</span>
            </button>
          </div>

          <div className="form-sections-wrapper">
            {/* Demographics Tab Content */}
            {activeTab === 'demographics' && (
              <div className="form-tab-panel animate-fade-in">
                <div className="form-grid">
                  {renderInput('Age', 'age', patientData.age, 'number', 'yrs', 'Range: 0-120')}
                  {renderInput('Sex', 'sex', patientData.sex, 'text', '', '', [
                    { val: 'M', lbl: 'Male' },
                    { val: 'F', lbl: 'Female' }
                  ])}
                  {renderInput('Altered Mentation', 'altered_mentation', patientData.altered_mentation, 'number', '', '', [
                    { val: 0, lbl: 'Alert / Alerted' },
                    { val: 1, lbl: 'Confused / Altered' }
                  ])}
                  {renderInput('Pain Score (Auto)', 'pain_score', patientData.pain_score, 'number', '/10', 'Auto from vitals', null, true)}
                  {renderInput('Chest Pain', 'chest_pain', patientData.chest_pain, 'number', '', '', [
                    { val: 0, lbl: 'No / Absent' },
                    { val: 1, lbl: 'Yes / Present' }
                  ])}
                  {renderInput('Diabetes History', 'diabetes', patientData.diabetes, 'number', '', '', [
                    { val: 0, lbl: 'No History' },
                    { val: 1, lbl: 'Diabetic' }
                  ])}
                </div>
              </div>
            )}

            {/* Vitals Tab Content */}
            {activeTab === 'vitals' && (
              <div className="form-tab-panel animate-fade-in">
                <div className="form-grid">
                  {renderInput('SpO₂', 'spo2', patientData.spo2, 'number', '%', 'Target: 95-100%')}
                  {renderInput('Resp Rate', 'respiratory_rate', patientData.respiratory_rate, 'number', '/min', 'Normal: 12-20')}
                  {renderInput('Temperature', 'temperature', patientData.temperature, 'number', '°C', 'Normal: 36.5-37.5')}
                  {renderInput('Heart Rate', 'heart_rate', patientData.heart_rate, 'number', 'bpm', 'Normal: 60-100')}
                  {renderInput('Systolic BP', 'systolic_bp', patientData.systolic_bp, 'number', 'mmHg', 'Normal: 90-120')}
                  {renderInput('Diastolic BP', 'diastolic_bp', patientData.diastolic_bp, 'number', 'mmHg', 'Normal: 60-80')}
                </div>
              </div>
            )}

            {/* Labs Tab Content */}
            {activeTab === 'labs' && (
              <div className="form-tab-panel animate-fade-in">
                <div className="form-grid-labs">
                  {renderInput('WBC Count', 'wbc', patientData.wbc, 'number', 'k/µL', 'Normal: 4.5-11.0')}
                  {renderInput('Hemoglobin', 'hemoglobin', patientData.hemoglobin, 'number', 'g/dL', 'Normal: 12.0-17.5')}
                  {renderInput('Platelets', 'platelet_count', patientData.platelet_count, 'number', 'k/µL', 'Normal: 150-450')}
                  {renderInput('Serum Sodium', 'sodium', patientData.sodium, 'number', 'mEq/L', 'Normal: 135-145')}
                  {renderInput('Potassium', 'potassium', patientData.potassium, 'number', 'mEq/L', 'Normal: 3.5-5.0')}
                  {renderInput('Creatinine', 'creatinine', patientData.creatinine, 'number', 'mg/dL', 'Normal: 0.6-1.2')}
                  {renderInput('Glucose', 'glucose', patientData.glucose, 'number', 'mg/dL', 'Normal: 70-140')}
                  {renderInput('Troponin', 'troponin', patientData.troponin, 'number', 'ng/mL', 'Normal: < 0.04')}
                  {renderInput('BNP', 'bnp', patientData.bnp, 'number', 'pg/mL', 'Normal: < 100')}
                  {renderInput('Lactate', 'lactate', patientData.lactate, 'number', 'mmol/L', 'Normal: 0.5-2.2')}
                  {renderInput('INR', 'inr', patientData.inr, 'number', '', 'Normal: 0.8-1.2')}
                </div>
              </div>
            )}
          </div>

          <button 
            className="btn primary full-width predict-btn" 
            onClick={handlePredict} 
            disabled={loading || !apiStatus}
          >
            {loading ? (
              <span className="spinner-group">
                <span className="spinner"></span>
                <span>Calculating Telemetry...</span>
              </span>
            ) : 'Analyze Clinical Risk'}
          </button>
          
          {error && <div className="error-msg">⚠️ {error}</div>}
        </section>
 
        {/* Right Column: Dynamic Results Grid */}
        <section className="results-section">
          {!predictions && !loading && (
            <div className="empty-state glass-panel">
              <div className="radar-sonar-container">
                <div className="sonar-wave"></div>
                <div className="sonar-center">🩺</div>
              </div>
              <h2>Ready for Diagnostic Assessment</h2>
              <p>Verify patient telemetry inputs above and trigger the multi-agent neural analytics system to compute clinical risks.</p>
            </div>
          )}

          {predictions && (
            <>
              {aggregation && (
                <div className="final-risk-banner glass-panel" style={{ '--card-color': getRiskColor(aggregation.final_risk) }}>
                  <div className="banner-alert-line">
                    <div className="banner-title-group">
                      <span className="siren-wrapper" style={{ color: getRiskColor(aggregation.final_risk) }}>
                        {aggregation.final_risk.includes('HIGH') ? <SirenIcon /> : <CheckIcon />}
                      </span>
                      <h2>Triage Alert: Risk Certified {aggregation.final_risk}</h2>
                    </div>
                    
                    <div className="risk-pill-badge" style={{ backgroundColor: getRiskColor(aggregation.final_risk) + '20', color: getRiskColor(aggregation.final_risk), borderColor: getRiskColor(aggregation.final_risk) }}>
                      {aggregation.final_risk} RISK
                    </div>
                  </div>
                  
                  <p className="explanation-paragraph">
                    {aggregation.explanation}
                  </p>
                  
                  {aggregation.safety_alerts && aggregation.safety_alerts.length > 0 && (
                    <div className="safety-alerts-box">
                      <div className="safety-alerts-title">🚨 ACTIVE CRITICAL CLINICAL ALERTS:</div>
                      {aggregation.safety_alerts.map((alert, i) => (
                        <div key={i} className="safety-alert-item">
                          <span>{alert}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="banner-footer">
                    <span>Aggregated Neural Fusion Confidence: <strong>{(aggregation.overall_confidence * 100).toFixed(1)}%</strong></span>
                  </div>
                </div>
              )}

              <div className="telemetry-dashboard-row">
                <div className="radar-container glass-panel">
                  <div className="radar-header">
                    <h3>Normalized Vitals Radar</h3>
                    <p className="chart-subtitle">Deviation from standard normal indices</p>
                  </div>
                  
                  <div className="radar-wrapper">
                    <RadarChart cx="50%" cy="50%" outerRadius="75%" width={500} height={350} data={processVitalsForRadar()}>
                      <defs>
                        <radialGradient id="radarGradient" cx="50%" cy="50%" r="80%">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.1} />
                          <stop offset="100%" stopColor="#2563eb" stopOpacity={0.4} />
                        </radialGradient>
                      </defs>
                      <PolarGrid stroke={isLightMode ? "#cbd5e1" : "rgba(255,255,255,0.12)"} gridType="circle" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: isLightMode ? "#475569" : "#94a3b8", fontSize: 12, fontWeight: 500 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar name="Vitals Deviation" dataKey="A" stroke="#2563eb" strokeWidth={2} fill="url(#radarGradient)" fillOpacity={0.6} dot={{ r: 4, fill: '#2563eb', stroke: '#fff', strokeWidth: 1.5 }} />
                      <Tooltip content={<CustomRadarTooltip />} />
                    </RadarChart>
                  </div>
                </div>
              </div>
              
              <div className="dashboard-grid">
                {renderCard('Respiratory Sub-Agent', 'respiratory', predictions.respiratory)}
                {renderCard('Cardiac Sub-Agent', 'cardiac', predictions.cardiac)}
                {renderCard('Sepsis Sub-Agent', 'sepsis', predictions.sepsis)}
                {renderCard('General Health Sub-Agent', 'general', predictions.general)}
              </div>
              
              {aggregation && (
                <div className="clinician-feedback-card glass-panel">
                  <div className="feedback-badge-header">
                    <div className="feedback-title-group">
                      <span className="feedback-icon">🔒</span>
                      <h3>Diagnostic Attestation & Sign-off</h3>
                    </div>
                    <span className="status-badge-pending">Pending Review</span>
                  </div>
                  <p className="feedback-description">
                    Please review the multi-agent diagnostic outputs. You can choose to certify the AI's triage risk assessment or log an override classification to support continuous learning.
                  </p>
                  
                  {feedbackStatus === 'success' ? (
                    <div className="feedback-success-state">
                      <div className="success-checkmark-circle">
                        <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" strokeWidth="3" fill="none">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                      <div>
                        <h4>Assessment Certified & Transmitted</h4>
                        <p>Your feedback has been successfully appended to the clinical audit log for retraining.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="feedback-actions-row">
                      <button 
                        className="btn-certify"
                        onClick={() => handleFeedback('accept')}
                        disabled={feedbackStatus === 'submitting'}
                      >
                        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Certify AI Prediction
                      </button>
                      
                      <div className="feedback-divider">
                        <span>OR</span>
                      </div>
                      
                      <div className="override-control-group">
                        <select 
                          value={overrideValue} 
                          onChange={(e) => setOverrideValue(e.target.value)}
                          className="override-select"
                        >
                          <option value="LOW">Low Risk</option>
                          <option value="MEDIUM">Medium Risk</option>
                          <option value="HIGH">High Risk</option>
                        </select>
                        <button 
                          className="btn-override"
                          onClick={() => handleFeedback('override')}
                          disabled={feedbackStatus === 'submitting'}
                        >
                          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                          </svg>
                          Submit Override
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>

      </main>
    </div>
  );
}

export default App;

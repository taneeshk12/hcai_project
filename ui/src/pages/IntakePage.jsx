import React, { useState, useRef, useEffect } from 'react';

const CLINICAL_RANGES = {
  age: { min: 0, max: 120, step: 1 },
  spo2: { min: 70, max: 100, step: 1 },
  respiratory_rate: { min: 5, max: 50, step: 1 },
  temperature: { min: 34.0, max: 42.0, step: 0.1 },
  heart_rate: { min: 30, max: 200, step: 1 },
  systolic_bp: { min: 60, max: 240, step: 1 },
  diastolic_bp: { min: 30, max: 140, step: 1 },
  wbc: { min: 1.0, max: 50.0, step: 0.1 },
  hemoglobin: { min: 5.0, max: 25.0, step: 0.1 },
  platelet_count: { min: 10, max: 1000, step: 5 },
  sodium: { min: 115, max: 160, step: 1 },
  potassium: { min: 1.5, max: 8.0, step: 0.1 },
  creatinine: { min: 0.1, max: 15.0, step: 0.1 },
  glucose: { min: 20, max: 600, step: 5 },
  troponin: { min: 0.0, max: 5.0, step: 0.01 },
  bnp: { min: 5, max: 5000, step: 10 },
  lactate: { min: 0.2, max: 20.0, step: 0.1 },
  inr: { min: 0.5, max: 10.0, step: 0.1 },
};

const API_BASE = 'http://localhost:8000';

const PLACEHOLDERS = {
  age: '45', sex: 'M', altered_mentation: '0', chest_pain: '0', diabetes: '0',
  spo2: '97', respiratory_rate: '16', temperature: '36.8', heart_rate: '70',
  systolic_bp: '120', diastolic_bp: '80', pain_score: '2',
  wbc: '7.5', hemoglobin: '14.0', platelet_count: '250', sodium: '140', potassium: '4.0',
  creatinine: '0.9', glucose: '100', troponin: '0.01', bnp: '50', lactate: '1.2', inr: '1.0'
};

export default function IntakePage({
  patientData, handleInputChange,
  loading, error, apiStatus,
  handlePredict,
  loadHealthyExample, loadHighRiskExample,
  setRagReport,
  triageMode = 'IMMEDIATE', setTriageMode,
}) {
  const [activeTab, setActiveTab] = useState('vitals');

  useEffect(() => {
    if (triageMode === 'IMMEDIATE' && activeTab === 'labs') {
      setActiveTab('vitals');
    }
  }, [triageMode, activeTab]);

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
              {value === '' && <option value="">Select...</option>}
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
                placeholder={PLACEHOLDERS[name] || ''}
                step={
                  name === 'temperature' ? '0.1'
                  : ['wbc', 'hemoglobin', 'potassium', 'creatinine', 'lactate', 'inr'].includes(name) ? '0.1'
                  : name === 'troponin' ? '0.01'
                  : '1'
                }
              />
              {unit && <span className="input-unit">{unit}</span>}
            </>
          )}
        </div>
      </div>
    );
  };

  const allTabs = [
    { key: 'demographics', label: 'Demographics' },
    { key: 'vitals',       label: 'Vitals & SpO\u2082' },
    { key: 'labs',         label: 'Lab Reports' },
    { key: 'symptoms',     label: '\uD83D\uDCDD Symptoms' },
  ];

  // In Immediate mode, hide the Lab Reports tab entirely
  const tabs = triageMode === 'IMMEDIATE'
    ? allTabs.filter(t => t.key !== 'labs')
    : allTabs;

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Patient Triage Intake</h2>
          <p className="page-subtitle">Enter patient telemetry, demographics, and lab values to trigger the multi-agent analysis.</p>
        </div>
        <div className="intake-preset-group">
          <button className="btn outline preset-btn" onClick={loadHealthyExample}>
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            Healthy Preset
          </button>
          <button className="btn outline preset-btn critical" onClick={loadHighRiskExample}>
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Critical Preset
          </button>
        </div>
      </div>

      {/* Triage Mode Selector */}
      <div className="triage-mode-container animate-fade-in">
        <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Triage Assessment Level</label>
        <div className="triage-mode-selector">
          <button
            type="button"
            className={`triage-mode-btn ${triageMode === 'IMMEDIATE' ? 'active' : ''}`}
            onClick={() => setTriageMode('IMMEDIATE')}
          >
            🩺 Immediate Triage (ER Arrival)
          </button>
          <button
            type="button"
            className={`triage-mode-btn ${triageMode === 'ENHANCED' ? 'active' : ''}`}
            onClick={() => setTriageMode('ENHANCED')}
          >
            🧪 Enhanced Triage (Labs Available)
          </button>
        </div>
      </div>



      {/* Tab Nav */}
      <div className="tab-navigation">
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
            type="button"
          >
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="intake-panels-grid">
        {activeTab === 'demographics' && (
          <div className="form-tab-panel animate-fade-in glass-panel">
            <div className="form-section-title">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Patient Demographics
            </div>
            <div className="form-grid">
              {renderInput('Age', 'age', patientData.age, 'number', 'yrs', 'Range: 0\u2013120')}
              {renderInput('Sex', 'sex', patientData.sex, 'text', '', '', [{ val: 'M', lbl: 'Male' }, { val: 'F', lbl: 'Female' }])}
              {renderInput('Altered Mentation', 'altered_mentation', patientData.altered_mentation, 'number', '', '', [{ val: 0, lbl: 'Alert / Normal' }, { val: 1, lbl: 'Confused / Altered' }])}
              {renderInput('Chest Pain', 'chest_pain', patientData.chest_pain, 'number', '', '', [{ val: 0, lbl: 'No / Absent' }, { val: 1, lbl: 'Yes / Present' }])}
              {renderInput('Diabetes', 'diabetes', patientData.diabetes, 'number', '', '', [{ val: 0, lbl: 'No History' }, { val: 1, lbl: 'Diabetic' }])}
              {renderInput('Pain Score (Auto)', 'pain_score', patientData.pain_score, 'number', '/10', 'Auto-calculated', null, true)}
            </div>
          </div>
        )}

        {activeTab === 'vitals' && (
          <div className="form-tab-panel animate-fade-in glass-panel">
            <div className="form-section-title">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              Vital Signs &amp; SpO\u2082
            </div>
            <div className="form-grid">
              {renderInput('SpO\u2082', 'spo2', patientData.spo2, 'number', '%', 'Target: 95\u2013100%')}
              {renderInput('Resp Rate', 'respiratory_rate', patientData.respiratory_rate, 'number', '/min', 'Normal: 12\u201320')}
              {renderInput('Temperature', 'temperature', patientData.temperature, 'number', '\u00b0C', 'Normal: 36.5\u201337.5')}
              {renderInput('Heart Rate', 'heart_rate', patientData.heart_rate, 'number', 'bpm', 'Normal: 60\u2013100')}
              {renderInput('Systolic BP', 'systolic_bp', patientData.systolic_bp, 'number', 'mmHg', 'Normal: 90\u2013120')}
              {renderInput('Diastolic BP', 'diastolic_bp', patientData.diastolic_bp, 'number', 'mmHg', 'Normal: 60\u201380')}
            </div>
          </div>
        )}

        {activeTab === 'labs' && (
          <div className="form-tab-panel animate-fade-in glass-panel">
            <div className="form-section-title">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18"/></svg>
              Laboratory Results
            </div>
            <div className="form-grid-labs">
              {renderInput('WBC Count', 'wbc', patientData.wbc, 'number', 'k/\u00b5L', 'Normal: 4.5\u201311.0')}
              {renderInput('Hemoglobin', 'hemoglobin', patientData.hemoglobin, 'number', 'g/dL', 'Normal: 12.0\u201317.5')}
              {renderInput('Platelets', 'platelet_count', patientData.platelet_count, 'number', 'k/\u00b5L', 'Normal: 150\u2013450')}
              {renderInput('Sodium', 'sodium', patientData.sodium, 'number', 'mEq/L', 'Normal: 135\u2013145')}
              {renderInput('Potassium', 'potassium', patientData.potassium, 'number', 'mEq/L', 'Normal: 3.5\u20135.0')}
              {renderInput('Creatinine', 'creatinine', patientData.creatinine, 'number', 'mg/dL', 'Normal: 0.6\u20131.2')}
              {renderInput('Glucose', 'glucose', patientData.glucose, 'number', 'mg/dL', 'Normal: 70\u2013140')}
              {renderInput('Troponin', 'troponin', patientData.troponin, 'number', 'ng/mL', 'Normal: < 0.04')}
              {renderInput('BNP', 'bnp', patientData.bnp, 'number', 'pg/mL', 'Normal: < 100')}
              {renderInput('Lactate', 'lactate', patientData.lactate, 'number', 'mmol/L', 'Normal: 0.5\u20132.2')}
              {renderInput('INR', 'inr', patientData.inr, 'number', '', 'Normal: 0.8\u20131.2')}
            </div>
          </div>
        )}

        {activeTab === 'symptoms' && (
          <div className="form-tab-panel animate-fade-in glass-panel">
            <div className="form-section-title">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Patient Symptoms
              <span className="chat-badge">FAISS \u00b7 Groq llama-3.3-70b</span>
            </div>
            
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: '1.5' }}>
              Describe the patient's symptoms in plain text. When you run the risk analysis, this will be automatically combined with the patient's demographics and vitals to generate a detailed symptom analysis using the FAISS/Groq RAG system.
            </p>

            <textarea
              className="chat-textarea"
              name="symptoms"
              placeholder="e.g. 65-year-old male with severe shortness of breath, chest pain, and altered mentation..."
              value={patientData.symptoms || ''}
              onChange={handleInputChange}
              rows={8}
              style={{ width: '100%', marginBottom: '1rem', borderRadius: '10px', padding: '12px', background: 'var(--input-bg)', color: 'var(--text-primary)', border: '1px solid var(--input-border)', fontFamily: 'inherit', fontSize: '0.85rem', resize: 'vertical' }}
            />
          </div>
        )}
      </div>

      {/* Analyze Button */}
      <div className="intake-analyze-section">
        {error && <div className="error-msg">\u26a0\uFE0F {error}</div>}
        <button
          className="btn primary full-width predict-btn"
          onClick={handlePredict}
          disabled={loading || !apiStatus}
        >
          {loading ? (
            <span className="spinner-group">
              <span className="spinner"></span>
              <span>Analyzing Clinical Data...</span>
            </span>
          ) : (
            <>
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Run Clinical Risk Analysis
            </>
          )}
        </button>
        {!apiStatus && (
          <p className="api-offline-note">\u26a0\uFE0F API engine is offline. Start the backend server to analyze.</p>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef, useCallback, Component } from 'react';
import axios from 'axios';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import PdfReportTemplate from './PdfReportTemplate';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import IntakePage from './pages/IntakePage';
import ResultsPage from './pages/ResultsPage';
import SimulatorPage from './pages/SimulatorPage';
import RegistryPage from './pages/RegistryPage';
import SettingsPage from './pages/SettingsPage';
import EvaluationPage from './pages/EvaluationPage';
import './App.css';

// ── Error Boundary: catches render crashes and shows a fallback instead of blank page ──
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('ResultsPage render error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="page-container animate-fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ padding: '2.5rem', maxWidth: 520, textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
            <h2 style={{ color: '#ef4444', marginBottom: '0.75rem' }}>Display Error</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              The results page encountered an error while rendering. The analysis completed successfully — please go back to Intake and re-run.
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: '6px', fontFamily: 'monospace' }}>
              {this.state.error?.message}
            </p>
            <button
              className="btn primary"
              style={{ marginTop: '1.5rem' }}
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const API_URL = 'http://localhost:8000';

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

const debounce = (func, delay) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => func(...args), delay);
  };
};

const getSweepPoints = (param) => {
  const range = CLINICAL_RANGES[param];
  if (!range) return [];
  const points = [];
  const step = (range.max - range.min) / 9;
  for (let i = 0; i < 10; i++) {
    const val = range.min + step * i;
    const rounded = range.step % 1 === 0
      ? Math.round(val)
      : parseFloat(val.toFixed(range.step.toString().split('.')[1]?.length || 1));
    points.push(rounded);
  }
  return points;
};

const INITIAL_PATIENT_DATA = {
  age: '', sex: '', age_group: 'adult', altered_mentation: '', chest_pain: '', diabetes: '',
  spo2: '', respiratory_rate: '', temperature: '', heart_rate: '',
  systolic_bp: '', diastolic_bp: '', pain_score: '',
  wbc: '', hemoglobin: '', platelet_count: '', sodium: '', potassium: '',
  creatinine: '', glucose: '', troponin: '', bnp: '', lactate: '', inr: '',
  symptoms: '',
};

function App() {
  // ── Navigation ───────────────────────────────────────────────────────────
  const [activePage, setActivePage] = useState('intake');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // ── Patient Identity ──────────────────────────────────────────────────────
  const [patientName, setPatientName] = useState('');
  const [currentPatientId, setCurrentPatientId] = useState(
    () => 'PT-' + Math.random().toString(36).substring(2, 10).toUpperCase()
  );

  // ── Registry ─────────────────────────────────────────────────────────────
  const [patientsList, setPatientsList] = useState([]);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [saveStatus, setSaveStatus] = useState(null);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState(null);
  const [activePatientAssessments, setActivePatientAssessments] = useState([]);

  // ── Patient Data ──────────────────────────────────────────────────────────
  const [patientData, setPatientData] = useState(INITIAL_PATIENT_DATA);
  const [triageMode, setTriageMode] = useState('IMMEDIATE');

  // ── Results ───────────────────────────────────────────────────────────────
  const [predictions, setPredictions] = useState(null);
  const [aggregation, setAggregation] = useState(null);
  const [llmSummary, setLlmSummary] = useState(null);
  const [fullReport, setFullReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [feedbackStatus, setFeedbackStatus] = useState(null);
  const [overrideValue, setOverrideValue] = useState('MEDIUM');
  const [expandedAgents, setExpandedAgents] = useState({});
  const [ragReport, setRagReport] = useState(null);

  // ── API & Theme ───────────────────────────────────────────────────────────
  const [apiStatus, setApiStatus] = useState(false);
  const [isLightMode, setIsLightMode] = useState(false);

  // ── Simulator ─────────────────────────────────────────────────────────────
  const [isWhatIfMode, setIsWhatIfMode] = useState(false);
  const [baselineData, setBaselineData] = useState(null);
  const [baselinePredictions, setBaselinePredictions] = useState(null);
  const [baselineAggregation, setBaselineAggregation] = useState(null);
  const [sensitivityParam, setSensitivityParam] = useState('spo2');
  const [sensitivityData, setSensitivityData] = useState([]);
  const [insightsTab, setInsightsTab] = useState('subsystem');
  const [toast, setToast] = useState(null);

  const reportRef = useRef(null);

  // ── Risk helper ───────────────────────────────────────────────────────────
  const getRiskPercentage = (agg) => {
    if (!agg) return 0;
    const conf = agg.overall_confidence ?? 0.5;
    if (agg.final_risk === 'HIGH') return 75 + conf * 25;
    if (agg.final_risk === 'MEDIUM' || agg.final_risk === 'MID') return 35 + conf * 40;
    return conf * 35;
  };

  // ── Sensitivity sweep ─────────────────────────────────────────────────────
  const runSensitivitySweep = async (currentData, param) => {
    const points = getSweepPoints(param);
    if (!points.length) return;
    const payload = points.map(val => ({ ...currentData, [param]: val }));
    try {
      const response = await axios.post(`${API_URL}/unified/batch`, payload);
      if (response.data.status === 'success') {
        setSensitivityData(response.data.results.map((res, idx) => ({
          val: points[idx],
          risk: parseFloat(getRiskPercentage(res.aggregation).toFixed(1)),
        })));
      }
    } catch (err) { console.error('Sensitivity sweep error:', err); }
  };

  // ── Debounced helpers ─────────────────────────────────────────────────────
  const debouncedPredict = useCallback(
    debounce(async (data) => {
      try {
        const response = await axios.post(`${API_URL}/unified/predict`, data);
        if (response.data.status === 'success') {
          setPredictions(response.data.predictions);
          setAggregation(response.data.aggregation);
        }
      } catch (err) { console.error('Real-time predict error:', err); }
    }, 400), []
  );

  // Sweep is expensive (10 batch inferences) — use a long delay so it only fires
  // once the user has STOPPED dragging for 1.5 s.
  const debouncedSweep = useCallback(
    debounce(async (data, param) => { await runSensitivitySweep(data, param); }, 1500), []
  );



  // ── Theme effect ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (isLightMode) document.body.setAttribute('data-theme', 'light');
    else document.body.removeAttribute('data-theme');
  }, [isLightMode]);

  // ── Auto pain score + age group ───────────────────────────────────────────
  const { heart_rate: hr, systolic_bp: sbp, spo2, temperature: temp, altered_mentation: mentation, age } = patientData;
  useEffect(() => {
    let score = 0;
    if (mentation !== 1) {
      if (hr && hr > 110) score += 3; else if (hr && hr > 90) score += 1;
      if (sbp && (sbp > 160 || sbp < 90)) score += 3; else if (sbp && (sbp > 140 || sbp < 100)) score += 1;
      if (spo2 && spo2 < 90) score += 3; else if (spo2 && spo2 < 93) score += 1;
      if (temp && (temp > 38.5 || temp < 36.0)) score += 1;
    }
    let ageGrp = 'adult';
    if (age !== '' && age < 18) ageGrp = 'pediatric';
    else if (age !== '' && age < 65) ageGrp = 'adult';
    else if (age !== '' && age < 80) ageGrp = 'senior';
    else if (age !== '') ageGrp = 'elderly';

    if (patientData.pain_score !== score || patientData.age_group !== ageGrp) {
      setPatientData(prev => {
        const updated = { ...prev, pain_score: score, age_group: ageGrp };
        if (isWhatIfMode) {
          debouncedPredict(updated);
        }
        return updated;
      });
    }
  }, [age, hr, sbp, spo2, temp, mentation, isWhatIfMode, debouncedPredict, patientData.pain_score, patientData.age_group]);

  // ── API functions ─────────────────────────────────────────────────────────
  const checkApiHealth = async () => {
    try {
      const res = await axios.get(`${API_URL}/health`);
      setApiStatus(res.data.status === 'healthy');
    } catch { setApiStatus(false); }
  };

  const fetchPatients = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/patients`);
      if (res.data.status === 'success') setPatientsList(res.data.patients);
    } catch (err) { console.error('Registry fetch error:', err); }
  };

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    checkApiHealth();
    fetchPatients();
    const interval = setInterval(checkApiHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const showToast = (message, type = 'error') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    // Do not parse text fields
    const isTextField = ['sex', 'age_group', 'symptoms', 'clinical_notes', 'patient_name'].includes(name);
    const finalValue = isTextField ? value : (isNaN(value) || value === '' ? value : parseFloat(value));
    
    setPatientData(prev => {
      const updated = { ...prev, [name]: finalValue };
      if (isWhatIfMode) {
        debouncedPredict(updated);
        if (CLINICAL_RANGES[name]) debouncedSweep(updated, name);
      }
      return updated;
    });
  };

  const handlePredict = async () => {
    // Validate required vital signs
    const requiredVitals = {
      age: 'Age',
      spo2: 'SpO₂',
      respiratory_rate: 'Respiratory Rate',
      temperature: 'Temperature',
      heart_rate: 'Heart Rate',
      systolic_bp: 'Systolic BP',
      diastolic_bp: 'Diastolic BP'
    };

    const missingFields = [];
    for (const [key, label] of Object.entries(requiredVitals)) {
      const val = patientData[key];
      if (val === undefined || val === null || val === '') {
        missingFields.push(label);
      }
    }

    if (missingFields.length > 0) {
      showToast(`Missing required vitals: ${missingFields.join(', ')}`, 'error');
      return;
    }

    setLoading(true);
    setError(null);
    setSelectedAssessmentId(null);
    // Clear stale RAG report from previous run
    setRagReport(null);

    try {
      const payload = {
        ...patientData,
        patient_id: currentPatientId,
        patient_name: patientName.trim() || 'Anonymous',
        clinical_notes: patientData.symptoms || '',
        triage_mode: triageMode
      };

      // ── Fire RAG asynchronously (don't block HCAI result) ──
      const symptomsText = (patientData.symptoms || '').trim();
      if (symptomsText) {
        const infoStr =
          `${patientData.age}-year-old ${patientData.sex === 'M' ? 'male' : 'female'}. ` +
          `Vitals: Temp ${patientData.temperature}\u00b0C, HR ${patientData.heart_rate} bpm, ` +
          `SpO2 ${patientData.spo2}%, BP ${patientData.systolic_bp}/${patientData.diastolic_bp}. ` +
          `Symptoms: ${symptomsText}`;
        // Fire and forget — updates ragReport when it resolves
        axios.post(`${API_URL}/rag/chat`, { patient_info: infoStr })
          .then(ragRes => {
            if (ragRes?.data?.report) {
              setRagReport({ report: ragRes.data.report, sources: ragRes.data.sources || [] });
            }
          })
          .catch(err => console.error('RAG analysis error:', err));
      }

      // ── HCAI analyze (primary, awaited) ──
      const response = await axios.post(`${API_URL}/hcai/analyze`, payload);

      if (response.data.status === 'success') {
        setPredictions(response.data.predictions);
        setAggregation(response.data.aggregation);
        setLlmSummary(response.data.hcai_report?.llm_interpretation || null);
        setFullReport(response.data.hcai_report || null);
        setFeedbackStatus(null);
        fetchPatients();
        // Navigate to results immediately — RAG report will appear when ready
        setActivePage('results');
      } else {
        setError(response.data.error || 'Prediction failed');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Connection error. Is the API running?');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePatient = async () => {
    setSaveStatus('saving');
    try {
      await axios.post(`${API_URL}/api/patients`, {
        ...patientData, patient_id: currentPatientId, patient_name: patientName.trim() || 'Anonymous',
      });
      setSaveStatus('saved');
      fetchPatients();
      setTimeout(() => setSaveStatus(null), 2500);
    } catch { setSaveStatus('error'); setTimeout(() => setSaveStatus(null), 3000); }
  };

  const handleLoadPatient = async (pid) => {
    try {
      setRegistryLoading(true);
      const res = await axios.get(`${API_URL}/api/patients/${pid}`);
      if (res.data.status === 'success') {
        const p = res.data.patient;
        setCurrentPatientId(p.patient_id);
        setPatientName(p.patient_name || '');
        setTriageMode(p.triage_mode || 'IMMEDIATE');
        setPatientData({
          age: p.age, sex: p.sex, age_group: p.age_group,
          altered_mentation: p.altered_mentation, chest_pain: p.chest_pain, diabetes: p.diabetes,
          spo2: p.spo2, respiratory_rate: p.respiratory_rate, temperature: p.temperature,
          heart_rate: p.heart_rate, systolic_bp: p.systolic_bp, diastolic_bp: p.diastolic_bp,
          pain_score: p.pain_score, wbc: p.wbc, hemoglobin: p.hemoglobin,
          platelet_count: p.platelet_count, sodium: p.sodium, potassium: p.potassium,
          creatinine: p.creatinine, glucose: p.glucose, troponin: p.troponin,
          bnp: p.bnp, lactate: p.lactate, inr: p.inr,
        });
        if (p.assessments?.length > 0) {
          setActivePatientAssessments(p.assessments);
          const rd = p.assessments[0].report_data;
          if (rd?.predictions) {
            setPredictions(rd.predictions);
            setAggregation(rd.aggregation);
            setLlmSummary(rd.report?.llm_interpretation || null);
            setFullReport(rd.report || null);
            setFeedbackStatus(null);
            setSelectedAssessmentId(p.assessments[0].assessment_id);
          }
        } else {
          setActivePatientAssessments([]);
          setPredictions(null); setAggregation(null); setLlmSummary(null);
          setFullReport(null); setSelectedAssessmentId(null);
        }
        setActivePage('intake');
      }
    } catch (err) { console.error('Error loading patient:', err); }
    finally { setRegistryLoading(false); }
  };

  const handleLoadAssessment = (assessment) => {
    const rd = assessment.report_data;
    if (rd?.predictions) {
      setPredictions(rd.predictions);
      setAggregation(rd.aggregation);
      setLlmSummary(rd.report?.llm_interpretation || null);
      setFullReport(rd.report || null);
      setSelectedAssessmentId(assessment.assessment_id);
      setFeedbackStatus(null);
      if (assessment.triage_mode) {
        setTriageMode(assessment.triage_mode);
      } else if (rd.aggregation?.triage_mode) {
        setTriageMode(rd.aggregation.triage_mode);
      }
    }
  };

  const handleDeletePatient = async (pid, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this patient and all their assessment history?')) return;
    try {
      await axios.delete(`${API_URL}/api/patients/${pid}`);
      fetchPatients();
      if (pid === currentPatientId) handleNewPatient();
    } catch (err) { console.error('Error deleting patient:', err); }
  };

  const handleNewPatient = () => {
    setCurrentPatientId('PT-' + Math.random().toString(36).substring(2, 10).toUpperCase());
    setPatientName('');
    setActivePatientAssessments([]);
    setPatientData(INITIAL_PATIENT_DATA);
    setTriageMode('IMMEDIATE');
    setPredictions(null); setAggregation(null); setLlmSummary(null);
    setFullReport(null); setFeedbackStatus(null); setSelectedAssessmentId(null);
    setIsWhatIfMode(false); setBaselineData(null); setBaselinePredictions(null);
    setBaselineAggregation(null); setSensitivityData([]);
    setActivePage('intake');
  };

  const handleFeedback = async (action) => {
    try {
      setFeedbackStatus('submitting');
      await axios.post(`${API_URL}/feedback`, {
        patient_data: patientData,
        ai_final_risk: aggregation?.final_risk,
        clinician_override: action === 'override' ? overrideValue : aggregation?.final_risk,
        action,
      });
      setFeedbackStatus('success');
    } catch { setFeedbackStatus('error'); }
  };

  const loadHealthyExample = () => {
    setPatientData({
      age: 35, sex: 'M', age_group: 'adult', altered_mentation: 0, chest_pain: 0, diabetes: 0,
      spo2: 98, respiratory_rate: 14, temperature: 36.6, heart_rate: 65, systolic_bp: 115, diastolic_bp: 75, pain_score: 0,
      wbc: 6.0, hemoglobin: 15.0, platelet_count: 280, sodium: 140, potassium: 4.2,
      creatinine: 0.8, glucose: 90, troponin: 0.00, bnp: 20, lactate: 1.0, inr: 1.0,
    });
    setPredictions(null); setAggregation(null); setLlmSummary(null);
    setFeedbackStatus(null); setIsWhatIfMode(false); setBaselineData(null);
    setBaselinePredictions(null); setSensitivityData([]);
  };

  const loadHighRiskExample = () => {
    setPatientData({
      age: 72, sex: 'F', age_group: 'senior', altered_mentation: 1, chest_pain: 1, diabetes: 1,
      spo2: 88, respiratory_rate: 30, temperature: 39.5, heart_rate: 120, systolic_bp: 85, diastolic_bp: 50, pain_score: 8,
      wbc: 18.0, hemoglobin: 10.0, platelet_count: 90, sodium: 130, potassium: 5.5,
      creatinine: 2.5, glucose: 250, troponin: 0.8, bnp: 800, lactate: 4.5, inr: 2.1,
    });
    setPredictions(null); setAggregation(null); setLlmSummary(null);
    setFeedbackStatus(null); setIsWhatIfMode(false); setBaselineData(null);
    setBaselinePredictions(null); setSensitivityData([]);
  };

  const downloadReport = async () => {
    if (!fullReport || !reportRef.current) return;
    const el = reportRef.current;
    const origStyles = { position: el.style.position, left: el.style.left, top: el.style.top, zIndex: el.style.zIndex, visibility: el.style.visibility };
    try {
      setFeedbackStatus('submitting');
      Object.assign(el.style, { position: 'absolute', left: '0', top: '0', zIndex: '-9999', visibility: 'visible' });
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
      const pdf = new jsPDF('p', 'pt', 'a4');
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const imgHeight = (canvas.height * pw) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, pw, imgHeight);
      heightLeft -= ph;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pw, imgHeight);
        heightLeft -= ph;
      }

      pdf.save(`${fullReport.report_id || 'triage_report'}.pdf`);
    } catch (err) { console.error('PDF error:', err); }
    finally { Object.assign(el.style, origStyles); setFeedbackStatus(null); }
  };

  // ── Page renderer ─────────────────────────────────────────────────────────
  const renderPage = () => {
    switch (activePage) {
      case 'intake':
        return (
          <ErrorBoundary>
            <IntakePage
              patientData={patientData}
              handleInputChange={handleInputChange}
              loading={loading}
              error={error}
              apiStatus={apiStatus}
              handlePredict={handlePredict}
              loadHealthyExample={loadHealthyExample}
              loadHighRiskExample={loadHighRiskExample}
              setRagReport={setRagReport}
              triageMode={triageMode}
              setTriageMode={setTriageMode}
            />
          </ErrorBoundary>
        );

      case 'results':
        return (
          <ErrorBoundary>
            <ResultsPage
              predictions={predictions}
              aggregation={aggregation}
              llmSummary={llmSummary}
              fullReport={fullReport}
              ragReport={ragReport}
              patientData={patientData}
              feedbackStatus={feedbackStatus}
              setFeedbackStatus={setFeedbackStatus}
              overrideValue={overrideValue}
              setOverrideValue={setOverrideValue}
              handleFeedback={handleFeedback}
              downloadReport={downloadReport}
              reportRef={reportRef}
              expandedAgents={expandedAgents}
              setExpandedAgents={setExpandedAgents}
              activePatientAssessments={activePatientAssessments}
              selectedAssessmentId={selectedAssessmentId}
              handleLoadAssessment={handleLoadAssessment}
            />
          </ErrorBoundary>
        );

      case 'simulator':
        return (
          <SimulatorPage
            predictions={predictions}
            aggregation={aggregation}
            patientData={patientData}
            setPatientData={setPatientData}
            baselineData={baselineData}
            setBaselineData={setBaselineData}
            baselinePredictions={baselinePredictions}
            setBaselinePredictions={setBaselinePredictions}
            baselineAggregation={baselineAggregation}
            setBaselineAggregation={setBaselineAggregation}
            isWhatIfMode={isWhatIfMode}
            setIsWhatIfMode={setIsWhatIfMode}
            sensitivityData={sensitivityData}
            setSensitivityData={setSensitivityData}
            sensitivityParam={sensitivityParam}
            setSensitivityParam={setSensitivityParam}
            insightsTab={insightsTab}
            setInsightsTab={setInsightsTab}
            debouncedPredict={debouncedPredict}
            debouncedSweep={debouncedSweep}
            runSensitivitySweep={runSensitivitySweep}
            loading={loading}
            setLoading={setLoading}
            setError={setError}
            patientName={patientName}
            currentPatientId={currentPatientId}
            API_URL={API_URL}
            axios={axios}
            setPredictions={setPredictions}
            setAggregation={setAggregation}
            setLlmSummary={setLlmSummary}
            setFullReport={setFullReport}
            setFeedbackStatus={setFeedbackStatus}
          />
        );
      case 'registry':
        return (
          <RegistryPage
            patientsList={patientsList}
            patientSearch={patientSearch}
            setPatientSearch={setPatientSearch}
            registryLoading={registryLoading}
            currentPatientId={currentPatientId}
            handleLoadPatient={handleLoadPatient}
            handleDeletePatient={handleDeletePatient}
            handleNewPatient={handleNewPatient}
            fetchPatients={fetchPatients}
            activePatientAssessments={activePatientAssessments}
            selectedAssessmentId={selectedAssessmentId}
            handleLoadAssessment={handleLoadAssessment}
          />
        );
      case 'evaluation':
        return (
          <EvaluationPage
            API_URL={API_URL}
          />
        );
      case 'settings':
        return <SettingsPage isLightMode={isLightMode} setIsLightMode={setIsLightMode} apiStatus={apiStatus} />;
      default:
        return null;
    }
  };

  return (
    <div className="app-shell">
      <div className="glow-bg"></div>

      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        patientsList={patientsList}
        hasResults={!!predictions}
      />

      <div className="app-main">
        <TopBar
          activePage={activePage}
          patientName={patientName}
          setPatientName={setPatientName}
          currentPatientId={currentPatientId}
          apiStatus={apiStatus}
          isLightMode={isLightMode}
          setIsLightMode={setIsLightMode}
          saveStatus={saveStatus}
          onSave={handleSavePatient}
          onNewPatient={handleNewPatient}
          loading={loading}
        />

        <main className="page-content">
          {renderPage()}
        </main>
      </div>

      {/* Hidden PDF template */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', visibility: 'hidden', overflow: 'hidden' }}>
        <PdfReportTemplate 
          ref={reportRef} 
          fullReport={fullReport} 
          patientData={patientData} 
          predictions={predictions}
          ragReport={ragReport}
        />
      </div>

      {toast && (
        <div className={`clinical-toast ${toast.type}`}>
          <span>⚠️</span>
          <span>{toast.message}</span>
          <button className="toast-close-btn" onClick={() => setToast(null)}>×</button>
        </div>
      )}
    </div>
  );
}

export default App;

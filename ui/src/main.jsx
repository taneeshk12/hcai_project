import { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Root-level Error Boundary — catches ANY crash in the entire app tree
// and shows a visible "Reload" button instead of a blank page.
class RootErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[Root ErrorBoundary] Caught render error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: 'linear-gradient(135deg, #0f1117 0%, #1a1d2e 100%)',
          fontFamily: "'Inter', sans-serif",
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px',
            padding: '3rem 2.5rem',
            maxWidth: 480,
            textAlign: 'center',
            backdropFilter: 'blur(20px)',
          }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '1.2rem' }}>⚠️</div>
            <h2 style={{ color: '#ef4444', margin: '0 0 0.8rem', fontWeight: 700, fontSize: '1.4rem' }}>
              Application Error
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', margin: '0 0 1.5rem', lineHeight: 1.6, fontSize: '0.9rem' }}>
              The app encountered an unexpected error. Your analysis data is safe — click below to reload.
            </p>
            {this.state.error?.message && (
              <p style={{
                background: 'rgba(0,0,0,0.3)',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                color: 'rgba(255,255,255,0.4)',
                fontFamily: 'monospace',
                marginBottom: '1.5rem',
                wordBreak: 'break-word',
              }}>
                {this.state.error.message}
              </p>
            )}
            <button
              onClick={() => window.location.reload()}
              style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                padding: '12px 28px',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: 'pointer',
                letterSpacing: '0.3px',
              }}
            >
              🔄 Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
)

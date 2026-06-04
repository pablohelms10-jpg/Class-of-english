import React from 'react';
import './index.css';
import { MilaProvider, useMila } from './context/MilaContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import SummaryDetail from './pages/SummaryDetail';
import AuthGate from './components/AuthGate';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('Mila error:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: 'var(--bg-main, #f9f9f7)', padding: 32, textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-dark, #1a1a1a)', marginBottom: 8 }}>
            Algo salió mal
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-light, #777)', marginBottom: 24, maxWidth: 360 }}>
            {this.state.error?.message || 'Error inesperado'}
          </div>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            style={{
              padding: '10px 24px', borderRadius: 8, border: 'none',
              background: 'var(--text-dark, #1a1a1a)', color: '#fff',
              fontSize: 14, cursor: 'pointer',
            }}
          >
            Volver al inicio
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const { activeSummary, setActiveSummary } = useMila();
  return (
    <Layout>
      <ErrorBoundary key={activeSummary?.id} onReset={() => setActiveSummary(null)}>
        {activeSummary ? <SummaryDetail /> : <Home />}
      </ErrorBoundary>
    </Layout>
  );
}

export default function App() {
  return (
    <MilaProvider>
      <AuthGate>
        <AppContent />
      </AuthGate>
    </MilaProvider>
  );
}

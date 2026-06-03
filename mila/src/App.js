import React from 'react';
import './index.css';
import { MilaProvider, useMila } from './context/MilaContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import SummaryDetail from './pages/SummaryDetail';

function AppContent() {
  const { activeSummary } = useMila();
  return (
    <Layout>
      {activeSummary ? <SummaryDetail /> : <Home />}
    </Layout>
  );
}

export default function App() {
  return (
    <MilaProvider>
      <AppContent />
    </MilaProvider>
  );
}

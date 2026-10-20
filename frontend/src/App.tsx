import React, { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ShowcaseLandingPage } from './pages/ShowcaseLandingPage';
import { WorkstationDashboard } from './pages/WorkstationDashboard';
import { api, DemoSeedResponse, setToken } from './api/client';
import { demoSeedResponse } from './data/demoFixtures';

const AppContent: React.FC = () => {
  const { user, isLoading, logout } = useAuth();
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    return typeof window !== 'undefined' && localStorage.getItem('is_demo_mode') === 'true';
  });
  const [demoData, setDemoData] = useState<DemoSeedResponse | null>(() => {
    try {
      const stored = localStorage.getItem('demo_seed_data');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const handleLaunchDemo = async () => {
    // 1. Instantly activate demo mode with fixtures so UI transitions without network delay
    setToken(demoSeedResponse.access_token);
    localStorage.setItem('is_demo_mode', 'true');
    localStorage.setItem('demo_seed_data', JSON.stringify(demoSeedResponse));
    setDemoData(demoSeedResponse);
    setIsDemoMode(true);
    window.dispatchEvent(new CustomEvent('ai-grading:launch-demo'));

    // 2. Refresh with server seed in background if backend is reachable
    try {
      const seedResponse = await api.demo.seed(false).catch(() => null);
      if (seedResponse && seedResponse.access_token) {
        setToken(seedResponse.access_token);
        localStorage.setItem('demo_seed_data', JSON.stringify(seedResponse));
        setDemoData(seedResponse);
      }
    } catch {
      // already operating with baseline fixtures
    }
  };

  const handleExitDemo = () => {
    localStorage.removeItem('is_demo_mode');
    localStorage.removeItem('demo_seed_data');
    logout();
    setIsDemoMode(false);
    setDemoData(null);
  };

  const handleResetDemo = async () => {
    try {
      await api.demo.reset().catch(() => null);
      const reseeded = await api.demo.seed(true).catch(() => null);
      const data = reseeded || demoSeedResponse;
      if (data.access_token) {
        setToken(data.access_token);
      }
      localStorage.setItem('demo_seed_data', JSON.stringify(data));
      setDemoData(data);
    } catch {
      setDemoData({ ...demoSeedResponse });
    }
  };

  useEffect(() => {
    const onLaunchEvent = () => {
      setIsDemoMode(true);
    };
    window.addEventListener('ai-grading:launch-demo', onLaunchEvent);
    return () => {
      window.removeEventListener('ai-grading:launch-demo', onLaunchEvent);
    };
  }, []);

  if (isLoading && !isDemoMode) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 font-mono text-xs">
        Loading Instructor Workstation...
      </div>
    );
  }

  if (isDemoMode) {
    return (
      <WorkstationDashboard
        isDemoMode={true}
        demoData={demoData || demoSeedResponse}
        onExitDemo={handleExitDemo}
        onResetDemo={handleResetDemo}
      />
    );
  }

  if (!user) {
    return <ShowcaseLandingPage onLaunchDemo={handleLaunchDemo} />;
  }

  return <WorkstationDashboard onExitDemo={handleExitDemo} />;
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary fallbackTitle="Application Error">
      <ThemeProvider>
        <AuthProvider>
          <div data-testid="workstation-root" className="min-h-screen flex flex-col w-full max-w-full overflow-x-hidden">
            <AppContent />
          </div>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;

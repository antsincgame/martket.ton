import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import LoadingScreen from './components/LoadingScreen.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import './utils/preloader.ts'; // Initialize sacred preloader
import '@fontsource-variable/inter';
import '@fontsource/orbitron';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Suspense fallback={<LoadingScreen message="Initializing Sacred Realm..." />}>
        <App />
      </Suspense>
    </ErrorBoundary>
  </StrictMode>
);

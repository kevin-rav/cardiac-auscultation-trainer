import { useEffect, useState } from 'react';
import { Navigation, AudioTuner } from './components';

export function App() {
  const [currentPath, setCurrentPath] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname;
    }
    return '/';
  });

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const handleNavigate = (path: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', path);
      setCurrentPath(path);
    }
  };

  const isTunerRoute =
    currentPath.startsWith('/audio-tuner') ||
    (typeof window !== 'undefined' &&
      (window.location.hash === '#/audio-tuner' ||
        window.location.search.includes('tool=audio-tuner')));

  return (
    <div className="app-shell">
      <Navigation currentPath={currentPath} onNavigate={handleNavigate} />

      {isTunerRoute ? (
        <AudioTuner />
      ) : (
        <main className="trainer-placeholder">
          <h1>Cardiac Auscultation Trainer</h1>
          <p>
            Welcome to the Cardiac Auscultation Trainer. Use the top navigation bar to open the{' '}
            <button
              type="button"
              className="btn-link"
              onClick={() => {
                handleNavigate('/audio-tuner');
              }}
            >
              Audio Tuner & Filter Tool
            </button>
            .
          </p>
        </main>
      )}
    </div>
  );
}

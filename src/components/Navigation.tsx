interface NavigationProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export function Navigation({ currentPath, onNavigate }: NavigationProps) {
  const isTuner = currentPath.startsWith('/audio-tuner');

  return (
    <nav className="app-nav">
      <div className="nav-brand">
        <strong>Cardiac Auscultation Trainer</strong>
      </div>
      <div className="nav-links">
        <button
          type="button"
          className={`nav-link-btn ${!isTuner ? 'active' : ''}`}
          onClick={() => {
            onNavigate('/');
          }}
          data-testid="nav-main"
        >
          Trainer
        </button>
        <button
          type="button"
          className={`nav-link-btn ${isTuner ? 'active' : ''}`}
          onClick={() => {
            onNavigate('/audio-tuner');
          }}
          data-testid="nav-tuner"
        >
          Audio Tuner
        </button>
      </div>
    </nav>
  );
}

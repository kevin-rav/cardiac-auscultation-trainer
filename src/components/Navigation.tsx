import { Button } from '@/components/ui/button';

interface NavigationProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export function Navigation({ currentPath, onNavigate }: NavigationProps) {
  const isTuner = currentPath.startsWith('/audio-tuner');

  return (
    <nav className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
      <div className="text-base font-semibold tracking-tight text-card-foreground">
        Cardiac Auscultation Trainer
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant={!isTuner ? 'default' : 'ghost'}
          size="sm"
          onClick={() => {
            onNavigate('/');
          }}
          data-testid="nav-main"
        >
          Trainer
        </Button>
        <Button
          type="button"
          variant={isTuner ? 'default' : 'ghost'}
          size="sm"
          onClick={() => {
            onNavigate('/audio-tuner');
          }}
          data-testid="nav-tuner"
        >
          Audio Tuner
        </Button>
      </div>
    </nav>
  );
}

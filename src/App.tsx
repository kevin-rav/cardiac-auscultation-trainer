import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navigation currentPath={currentPath} onNavigate={handleNavigate} />

      {isTunerRoute ? (
        <AudioTuner />
      ) : (
        <main className="flex flex-1 items-center justify-center p-6">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  <h1 className="text-xl font-bold">Cardiac Auscultation Trainer</h1>
                </CardTitle>
                <Badge variant="secondary">Ready</Badge>
              </div>
              <CardDescription>
                Interactive clinical simulation for cardiac sound training.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Welcome to the Cardiac Auscultation Trainer. Use the top navigation bar to open the{' '}
                <Button
                  variant="link"
                  className="h-auto p-0 text-sm font-semibold"
                  onClick={() => {
                    handleNavigate('/audio-tuner');
                  }}
                >
                  Audio Tuner &amp; Filter Tool
                </Button>
                .
              </p>
              <Button
                variant="default"
                onClick={() => {
                  handleNavigate('/audio-tuner');
                }}
              >
                Open Audio Tuner &amp; Filter Tool
              </Button>
            </CardContent>
          </Card>
        </main>
      )}
    </div>
  );
}

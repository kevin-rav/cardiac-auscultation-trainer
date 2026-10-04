import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Navigation, AudioTuner } from './components';

// The app is served under a subpath on GitHub Pages, so routes are kept
// relative to Vite's base URL.
const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, '');

function getAppPath(): string {
  const { pathname } = window.location;
  const path = pathname.startsWith(BASE_PATH) ? pathname.slice(BASE_PATH.length) : pathname;
  return path || '/';
}

export function App() {
  const [currentPath, setCurrentPath] = useState(() => {
    if (typeof window !== 'undefined') {
      return getAppPath();
    }
    return '/';
  });

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(getAppPath());
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const handleNavigate = (path: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', BASE_PATH + path);
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
                </Button>{' '}
                or launch the{' '}
                <a
                  href={`${import.meta.env.BASE_URL}test-3d/`}
                  className="font-semibold text-primary underline underline-offset-4 hover:opacity-80"
                >
                  3D Torso Auscultation Explorer
                </a>
                .
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="default"
                  onClick={() => {
                    handleNavigate('/audio-tuner');
                  }}
                >
                  Open Audio Tuner &amp; Filter Tool
                </Button>
                <Button variant="outline" asChild>
                  <a href={`${import.meta.env.BASE_URL}test-3d/`}>Explore 3D Torso (test-3d)</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      )}
    </div>
  );
}

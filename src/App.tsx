import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function App() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <Card className="w-full max-w-md">
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
            Tailwind CSS and shadcn/ui are configured and ready.
          </p>
          <Button variant="default">Get Started</Button>
        </CardContent>
      </Card>
    </main>
  );
}

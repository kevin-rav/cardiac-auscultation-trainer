import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTunerStore } from '../../store';

export function JsonExportPanel() {
  const soundSet = useTunerStore((s) => s.soundSet);
  const validationError = useTunerStore((s) => s.validationError);
  const updateSoundSetMetadata = useTunerStore((s) => s.updateSoundSetMetadata);
  const exportJson = useTunerStore((s) => s.exportJson);
  const importJson = useTunerStore((s) => s.importJson);

  const [copied, setCopied] = useState(false);
  const [importText, setImportText] = useState('');
  const [showImportArea, setShowImportArea] = useState(false);

  const jsonContent = exportJson();

  const handleCopy = () => {
    void navigator.clipboard.writeText(jsonContent).then(() => {
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    });
  };

  const handleDownload = () => {
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${soundSet.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    if (!importText.trim()) return;
    const success = importJson(importText);
    if (success) {
      setShowImportArea(false);
      setImportText('');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h3 className="text-base font-semibold text-card-foreground">
            Sound Set Metadata &amp; JSON Schema
          </h3>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* Metadata fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="soundset-label"
              className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
            >
              Set Name / Label:
            </label>
            <input
              id="soundset-label"
              type="text"
              className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              value={soundSet.label}
              onChange={(e) => {
                updateSoundSetMetadata(e.target.value, soundSet.id, soundSet.description);
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="soundset-id"
              className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
            >
              Set Identifier (id):
            </label>
            <input
              id="soundset-id"
              type="text"
              className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              value={soundSet.id}
              onChange={(e) => {
                updateSoundSetMetadata(soundSet.label, e.target.value, soundSet.description);
              }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="soundset-desc"
            className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
          >
            Description:
          </label>
          <input
            id="soundset-desc"
            type="text"
            className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            value={soundSet.description ?? ''}
            onChange={(e) => {
              updateSoundSetMetadata(soundSet.label, soundSet.id, e.target.value);
            }}
            placeholder="Clinical description or notes for nurses"
          />
        </div>

        {validationError && (
          <div
            className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
            role="alert"
            data-testid="validation-error"
          >
            <strong>Validation Error:</strong> {validationError}
          </div>
        )}

        {/* Export / Import actions */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            data-testid="copy-json-btn"
          >
            {copied ? '✓ Copied to Clipboard!' : '📋 Copy JSON'}
          </Button>

          <Button type="button" variant="outline" size="sm" onClick={handleDownload}>
            ⬇ Download .json
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setShowImportArea(!showImportArea);
            }}
            data-testid="toggle-import-btn"
          >
            {showImportArea ? 'Hide Import' : '⤴ Import JSON'}
          </Button>
        </div>

        {showImportArea && (
          <div className="flex flex-col gap-2 rounded-lg border border-border p-3.5 bg-muted/20">
            <label
              htmlFor="json-import-textarea"
              className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
            >
              Paste Sound Set JSON:
            </label>
            <textarea
              id="json-import-textarea"
              className="flex min-h-24 w-full rounded-md border border-input bg-background p-2 font-mono text-xs shadow-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              rows={6}
              value={importText}
              onChange={(e) => {
                setImportText(e.target.value);
              }}
              placeholder='{"id": "...", "label": "...", "events": [...]}'
              data-testid="import-textarea"
            />
            <div>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleImport}
                data-testid="apply-import-btn"
              >
                Apply &amp; Validate JSON
              </Button>
            </div>
          </div>
        )}

        {/* Formatted JSON Output */}
        <div className="flex flex-col gap-1.5 pt-1">
          <label
            htmlFor="json-live-preview"
            className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
          >
            Live Zod Schema JSON:
          </label>
          <pre
            id="json-live-preview"
            className="max-h-64 overflow-x-auto rounded-lg border border-border bg-muted/40 p-3.5 font-mono text-xs text-muted-foreground"
          >
            <code>{jsonContent}</code>
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}

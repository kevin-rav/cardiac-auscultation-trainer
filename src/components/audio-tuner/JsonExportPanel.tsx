import { useState } from 'react';
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
    <section className="tuner-panel">
      <h3 className="panel-title">Sound Set Metadata & JSON Schema</h3>

      {/* Metadata fields */}
      <div className="grid-2col">
        <div className="field-group">
          <label htmlFor="soundset-label" className="field-label">
            Set Name / Label:
          </label>
          <input
            id="soundset-label"
            type="text"
            className="text-input"
            value={soundSet.label}
            onChange={(e) => {
              updateSoundSetMetadata(e.target.value, soundSet.id, soundSet.description);
            }}
          />
        </div>

        <div className="field-group">
          <label htmlFor="soundset-id" className="field-label">
            Set Identifier (id):
          </label>
          <input
            id="soundset-id"
            type="text"
            className="text-input"
            value={soundSet.id}
            onChange={(e) => {
              updateSoundSetMetadata(soundSet.label, e.target.value, soundSet.description);
            }}
          />
        </div>
      </div>

      <div className="field-group">
        <label htmlFor="soundset-desc" className="field-label">
          Description:
        </label>
        <input
          id="soundset-desc"
          type="text"
          className="text-input"
          value={soundSet.description ?? ''}
          onChange={(e) => {
            updateSoundSetMetadata(soundSet.label, soundSet.id, e.target.value);
          }}
          placeholder="Clinical description or notes for nurses"
        />
      </div>

      {validationError && (
        <div className="alert-error" role="alert" data-testid="validation-error">
          <strong>Validation Error:</strong> {validationError}
        </div>
      )}

      {/* Export / Import actions */}
      <div className="json-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleCopy}
          data-testid="copy-json-btn"
        >
          {copied ? '✓ Copied to Clipboard!' : '📋 Copy JSON'}
        </button>

        <button type="button" className="btn btn-secondary" onClick={handleDownload}>
          ⬇ Download .json
        </button>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setShowImportArea(!showImportArea);
          }}
          data-testid="toggle-import-btn"
        >
          {showImportArea ? 'Hide Import' : '⤴ Import JSON'}
        </button>
      </div>

      {showImportArea && (
        <div className="import-box">
          <label htmlFor="json-import-textarea" className="field-label">
            Paste Sound Set JSON:
          </label>
          <textarea
            id="json-import-textarea"
            className="json-textarea"
            rows={6}
            value={importText}
            onChange={(e) => {
              setImportText(e.target.value);
            }}
            placeholder='{"id": "...", "label": "...", "events": [...]}'
            data-testid="import-textarea"
          />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleImport}
            data-testid="apply-import-btn"
          >
            Apply & Validate JSON
          </button>
        </div>
      )}

      {/* Formatted JSON Output */}
      <div className="json-viewer-container">
        <label htmlFor="json-live-preview" className="field-label">
          Live Zod Schema JSON:
        </label>
        <pre id="json-live-preview" className="json-pre">
          <code>{jsonContent}</code>
        </pre>
      </div>
    </section>
  );
}

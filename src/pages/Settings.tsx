import { useState } from 'preact/hooks';
import { DEFAULT_MODEL } from '../config';
import { listModels, type ModelInfo } from '../lib/openrouter';
import { apiKey, exportJson, importJson, resetProgress, settings, updateSettings } from '../state/store';

export function SettingsPage() {
  const [keyDraft, setKeyDraft] = useState(apiKey.value);
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelMsg, setModelMsg] = useState('');
  const [importMsg, setImportMsg] = useState('');
  const s = settings.value;

  const loadModels = async () => {
    setModelMsg('Loading…');
    try {
      const m = await listModels();
      setModels(m);
      setModelMsg(`${m.length} models available.`);
    } catch (e) {
      setModelMsg((e as Error).message);
    }
  };

  const download = () => {
    const blob = new Blob([exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `eloquacity-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const upload = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      importJson(await file.text());
      setImportMsg('Imported and merged with your current progress.');
    } catch (err) {
      setImportMsg(`Could not import: ${(err as Error).message}`);
    }
  };

  const keyInputProps = {
    value: keyDraft, placeholder: 'sk-or-…', autocomplete: 'off', spellcheck: false, style: { maxWidth: '420px' }, 'aria-label': 'OpenRouter API key',
    onInput: (e: Event) => setKeyDraft((e.target as HTMLInputElement).value.trim()),
  };
  const modelKnown = (id: string) => !models.length || models.some((m) => m.id === id);

  return (
    <div>
      <div class="eyebrow">Settings</div>
      <h1>Settings</h1>

      <section class="panel">
        <h2>OpenRouter key</h2>
        <p class="muted small">
          Used only for AI notes. It is stored in this browser’s local storage, sent only to <code>openrouter.ai</code>,
          never synced to your account and never included in exports. Get one at <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">openrouter.ai/keys</a>; a spending limit on the key is wise.
        </p>
        <div class="btn-row" style={{ marginTop: 0 }}>
          {showKey ? (
            <input type="text" {...keyInputProps} />
          ) : (
            <input type="password" {...keyInputProps} />
          )}
          <button onClick={() => setShowKey(!showKey)}>{showKey ? 'Hide' : 'Show'}</button>
          <button class="btn-primary" onClick={() => (apiKey.value = keyDraft)} disabled={keyDraft === apiKey.value}>Save key</button>
          {apiKey.value && <button onClick={() => { apiKey.value = ''; setKeyDraft(''); }}>Remove</button>}
        </div>
        {apiKey.value && <p class="up small">✓ Key saved in this browser.</p>}
      </section>

      <section class="panel">
        <h2>Judge model</h2>
        <p class="muted small">Any OpenRouter model ID. It runs at low temperature and works best on a model that supports structured JSON output. Whatever the model, the notes are told to judge against your aim and never to nudge you toward a polished middle style.</p>
        <div class="field">
          <label for="judge">Judge model</label>
          <input id="judge" type="text" list="model-list" value={s.judge_model} onChange={(e) => updateSettings({ judge_model: (e.target as HTMLInputElement).value.trim() || DEFAULT_MODEL })} />
          {!modelKnown(s.judge_model) && <small class="down">Not in OpenRouter’s current list.</small>}
        </div>
        <datalist id="model-list">{models.map((m) => <option value={m.id}>{m.name}</option>)}</datalist>
        <div class="btn-row" style={{ marginTop: 0 }}>
          <button onClick={loadModels}>Load model list</button>
          <span class="muted small" style={{ alignSelf: 'center' }}>{modelMsg}</span>
        </div>
      </section>

      <section class="panel">
        <h2>Display</h2>
        <div class="grid grid-2">
          <div class="field">
            <label>Explanations</label>
            <div class="seg" role="group" aria-label="Explanation lens">
              {(['kat', 'both', 'richard'] as const).map((l) => (
                <button aria-pressed={s.lens === l} onClick={() => updateSettings({ lens: l })}>{l === 'both' ? 'Both' : l === 'kat' ? 'The shape' : 'Step by step'}</button>
              ))}
            </div>
            <small>“The shape” is compressed and pattern-first; “Step by step” is plain and sequential.</small>
          </div>
          <div class="field">
            <label>Theme</label>
            <div class="seg" role="group" aria-label="Theme">
              {(['auto', 'light', 'dark'] as const).map((t) => (
                <button aria-pressed={s.theme === t} onClick={() => updateSettings({ theme: t })}>{t === 'auto' ? 'System' : t === 'light' ? 'Ink on paper' : 'Lamplit'}</button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section class="panel">
        <h2>Your data</h2>
        <p class="muted small">Export saved pieces, practice history and judge transcripts as JSON. Importing merges with what’s here; nothing is overwritten.</p>
        <div class="btn-row" style={{ marginTop: 0 }}>
          <button onClick={download}>Export JSON</button>
          <label class="btn" style={{ margin: 0 }}>
            Import JSON
            <input type="file" accept="application/json,.json" onChange={upload} style={{ display: 'none' }} />
          </label>
          <button onClick={() => confirm('Delete all saved pieces and practice history in this browser (and your synced copy, if signed in)? Export first if unsure.') && resetProgress()} class="danger">
            Reset everything
          </button>
        </div>
        {importMsg && <p class="small">{importMsg}</p>}
      </section>
    </div>
  );
}

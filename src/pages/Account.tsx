import { useState } from 'preact/hooks';
import { errorMessage, forgotPassword, resetPassword } from '../lib/cloud';
import { isAdmin, loginAndSync, logoutAndKeepLocal, profile, signupAndSync, syncNow, syncState } from '../state/store';

type Mode = 'login' | 'signup' | 'forgot' | 'reset';

export function Account() {
  const p = profile.value;
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = async (fn: () => Promise<unknown>, okText?: string) => {
    setBusy(true); setMsg(null);
    try {
      await fn();
      if (okText) setMsg({ ok: true, text: okText });
    } catch (e) {
      setMsg({ ok: false, text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  if (p) {
    const s = syncState.value;
    return (
      <div>
        <div class="eyebrow">Account</div>
        <h1>Signed in</h1>
        <section class="panel">
          <p><strong>{p.name || p.email || 'Your account'}</strong>{p.email && p.name ? <span class="muted"> · {p.email}</span> : null}</p>
          <p class="mono muted" style={{ fontSize: '0.78rem' }}>User ID: {p.user_id} · access group {p.access_group}{isAdmin.value ? ' · admin' : ''}</p>
          <p>
            Sync: <strong>{s.status}</strong>
            {s.at && <span class="muted"> · last {new Date(s.at).toLocaleTimeString()}</span>}
            {s.message && <span class="down"> · {s.message}</span>}
          </p>
          <p class="muted" style={{ fontSize: '0.92rem' }}>
            Saved pieces and practice history sync to a private record that only you can read. Your OpenRouter key never leaves this browser.
          </p>
          <div class="btn-row">
            <button onClick={() => run(syncNow)} disabled={busy}>Sync now</button>
            <button onClick={() => run(logoutAndKeepLocal)} disabled={busy}>Sign out</button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div>
      <div class="eyebrow">Account</div>
      <h1>{mode === 'signup' ? 'Create an account' : mode === 'login' ? 'Sign in' : 'Reset password'}</h1>
      <p class="muted lede">
        Optional. Everything works without an account; signing in adds sync across devices. Work you saved while signed out is merged in, not lost. It’s the same account as The Rhetoric Forge’s, so if you have one there, sign in with it.
      </p>
      <section class="panel" style={{ maxWidth: '480px' }}>
        <form onSubmit={(e) => {
          e.preventDefault();
          if (mode === 'login') void run(() => loginAndSync(email, password));
          else if (mode === 'signup') void run(() => signupAndSync(email, password, name || undefined));
          else if (mode === 'forgot') void run(async () => { await forgotPassword(email); setMode('reset'); }, 'A code has been emailed to you.');
          else void run(async () => { await resetPassword(email, code, password); setMode('login'); }, 'Password changed. Sign in with the new one.');
        }}>
          {mode === 'signup' && (
            <div class="field"><label for="name">Name (optional)</label><input id="name" type="text" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} /></div>
          )}
          <div class="field"><label for="email">Email</label><input id="email" type="email" required autocomplete="email" value={email} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} /></div>
          {mode === 'reset' && (
            <div class="field"><label for="code">Code from the email</label><input id="code" type="text" required value={code} onInput={(e) => setCode((e.target as HTMLInputElement).value)} /></div>
          )}
          {mode !== 'forgot' && (
            <div class="field">
              <label for="pw">{mode === 'reset' ? 'New password' : 'Password'}</label>
              <input id="pw" type="password" required minLength={6} maxLength={60} autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password} onInput={(e) => setPassword((e.target as HTMLInputElement).value)} />
            </div>
          )}
          <div class="btn-row">
            <button class="btn-primary" type="submit" disabled={busy}>
              {busy ? '…' : mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Email me a code' : 'Set new password'}
            </button>
          </div>
        </form>
        {msg && <div class={`notice ${msg.ok ? 'good' : 'bad'}`}>{msg.text}</div>}
        <hr class="hr" />
        <div class="btn-row" style={{ marginTop: 0 }}>
          {mode !== 'login' && <button class="btn-quiet" onClick={() => { setMode('login'); setMsg(null); }}>Have an account? Sign in</button>}
          {mode !== 'signup' && <button class="btn-quiet" onClick={() => { setMode('signup'); setMsg(null); }}>Create an account</button>}
          {mode === 'login' && <button class="btn-quiet" onClick={() => { setMode('forgot'); setMsg(null); }}>Forgot password?</button>}
        </div>
      </section>
    </div>
  );
}

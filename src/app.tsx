import { APP_TITLE, FORGE_URL } from './config';
import { route } from './state/router';
import { profile, settings, syncState } from './state/store';
import { Home } from './pages/Home';
import { FreeDesk } from './pages/FreeDesk';
import { Prose } from './pages/Prose';
import { Shapeshifter } from './pages/Shapeshifter';
import { Ladders } from './pages/Ladders';
import { RegisterDial } from './pages/RegisterDial';
import { Imitation } from './pages/Imitation';
import { Restore } from './pages/Restore';
import { Portfolio } from './pages/Portfolio';
import { Telemetry } from './pages/Telemetry';
import { SettingsPage } from './pages/Settings';
import { Account } from './pages/Account';

const NAV = [
  ['/prose', 'Prose'],
  ['/desk', 'Free Desk'],
  ['/portfolio', 'Portfolio'],
  ['/telemetry', 'Telemetry'],
  ['/settings', 'Settings'],
] as const;

function Page() {
  const path = route.value;
  if (path === '/') return <Home />;
  if (path === '/desk') return <FreeDesk />;
  if (path === '/prose') return <Prose />;
  if (path === '/prose/shapeshifter') return <Shapeshifter />;
  if (path === '/prose/ladders') return <Ladders />;
  if (path === '/prose/dial') return <RegisterDial />;
  if (path === '/prose/imitation') return <Imitation />;
  if (path === '/prose/restore') return <Restore />;
  if (path === '/portfolio') return <Portfolio />;
  if (path === '/telemetry') return <Telemetry />;
  if (path === '/settings') return <SettingsPage />;
  if (path === '/account') return <Account />;
  return (
    <div class="panel">
      <h1>Not found</h1>
      <p><a href="#/">Back to the desk</a></p>
    </div>
  );
}

export function App() {
  const path = route.value;
  const active = (p: string) => (path === p || path.startsWith(p + '/') ? 'page' : undefined);
  const theme = settings.value.theme;
  const cycleTheme = () => (settings.value = { ...settings.value, theme: theme === 'auto' ? 'light' : theme === 'light' ? 'dark' : 'auto' });
  const sync = syncState.value;
  return (
    <div class="shell">
      <header class="topbar">
        <a class="brand" href="#/" aria-label={APP_TITLE}>Eloqua<span>city</span></a>
        <nav class="nav" aria-label="Main">
          {NAV.map(([p, label]) => <a href={`#${p}`} aria-current={active(p)}>{label}</a>)}
          <a href="#/account" aria-current={active('/account')}>
            {profile.value ? `Account${sync.status === 'syncing' ? ' ⟳' : sync.status === 'error' ? ' ⚠' : ''}` : 'Sign in'}
          </a>
        </nav>
        <button class="btn-quiet theme" onClick={cycleTheme} title={`Theme: ${theme} (click to change)`} aria-label={`Theme: ${theme}`}>
          {theme === 'auto' ? 'System' : theme === 'light' ? 'Paper' : 'Lamplit'}
        </button>
      </header>
      <main>
        <Page />
      </main>
      <footer class="footer">
        <span>Eloquacity: prose style and formal verse.</span>
        <span>Sister site: <a href={FORGE_URL}>The Rhetoric Forge</a></span>
      </footer>
    </div>
  );
}

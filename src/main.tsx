import { render } from 'preact';
import './styles.css';
import { App } from './app';
import { initAccount, refreshBank } from './state/store';

render(<App />, document.getElementById('app')!);

// Optional cloud features load in the background; the app is fully usable without them.
void initAccount().finally(() => void refreshBank());

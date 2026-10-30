// Playwright smoke pass: every page on desktop (light) and at 390px (dark),
// no console errors, no horizontal page scroll, and the Free Desk judge path with
// OpenRouter mocked. Never calls the live API.
//
//   npm run build && npx vite preview --port 4173 &
//   node e2e/smoke.mjs [baseUrl] [screenshotDir]
//
// Needs the `playwright` package and a Chromium it can find (`npx playwright install chromium`).

import { createRequire } from 'node:module';

// require() (unlike import) honours NODE_PATH, so a globally installed Playwright works too.
const { chromium } = createRequire(import.meta.url)('playwright');

const BASE = process.argv[2] ?? 'http://localhost:4173/';
const SHOTS = process.argv[3] ?? '';
const PAGES = ['/', '/desk', '/portfolio', '/telemetry', '/settings', '/account'];

const TEXT = [
  'The rain came. It did not stop.',
  'It fell on the roofs and the yards and the long grey road out of town, where the carts stood axle-deep and the horses waited with their heads down, patient as stones, while the drivers argued under the eaves about whether the bridge would hold.',
  'It held. Mostly.',
].join(' ');

const NOTES = {
  paraphrases: [{ n: 3, paraphrase: 'Rain soaked everything; carts were stuck; drivers argued about the bridge.' }],
  strongest: { quote: 'patient as stones', why: 'Three plain words give the horses weight and stillness.' },
  weakest: { quote: 'about whether the bridge would hold', why: 'The clause trails off just as the sentence should land.' },
  aim_note: 'Blunt enough in the short sentences; the long one drifts toward lush.',
  checklist: [1, 2, 3, 4].map((n) => ({ n, answer: n === 1 ? 'partly' : 'yes' })),
};

async function mockOpenRouter(page) {
  await page.route('https://openrouter.ai/**', async (route) => {
    const body = route.request().postDataJSON();
    const isJson = !!body?.response_format || /JSON Schema/.test(body?.messages?.[0]?.content ?? '');
    const content = isJson ? JSON.stringify(NOTES) : 'One possible version, mocked.';
    await route.fulfill({ json: { choices: [{ message: { content } }] } });
  });
}

const problems = [];
const fail = (msg) => {
  problems.push(msg);
  console.log('  ✗', msg);
};

async function checkPage(page, path, label, errors) {
  await page.goto(`${BASE}#${path}`);
  await page.waitForTimeout(250);
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  if (sw > cw) fail(`${label} ${path}: horizontal scroll (${sw} > ${cw})`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${label}${path.replace(/\//g, '_') || '_home'}.png`, fullPage: true });
  if (errors.length) fail(`${label} ${path}: console errors: ${errors.splice(0).join(' | ')}`);
}

async function run(label, viewport, colorScheme) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport, colorScheme });
  const page = await ctx.newPage();
  const errors = [];
  let blockedCloud = false;
  // The only errors we tolerate are the SDK's reports of the Skapi calls we block below.
  const expected = (t) => blockedCloud && /^(Failed to load resource: net::ERR_FAILED|Network error)$/.test(t);
  page.on('console', (m) => m.type() === 'error' && !expected(m.text()) && errors.push(m.text()));
  // With Skapi blocked, the SDK's own connection promise can reject unhandled on a reload ("Network error").
  // That's the offline case only; the app itself degrades to local-only.
  page.on('pageerror', (e) => !expected(String(e)) && errors.push(String(e)));
  page.on('dialog', (d) => d.accept());
  // Keep the cloud quiet in tests: no live Skapi either.
  await page.route((url) => url.hostname !== 'localhost' && /skapi|amazonaws/.test(url.href), (route) => {
    blockedCloud = true;
    return route.abort();
  });
  await mockOpenRouter(page);
  console.log(`${label} ${viewport.width}px ${colorScheme}`);

  for (const p of PAGES) await checkPage(page, p, label, errors);

  // Free Desk: strip, save, judge path.
  await page.goto(`${BASE}#/desk`);
  await page.fill('.desk-text', TEXT);
  const notes = await page.locator('.strip .note').count();
  if (notes !== 5) fail(`${label}: expected 5 notes on the strip, saw ${notes}`);
  await page.click('text=Save to portfolio');
  await page.evaluate(() => localStorage.setItem('eq.openrouter_key', 'sk-or-test'));
  await page.reload();
  await page.click('text=Blunt and vivid');
  await page.click('text=Get AI notes');
  await page.waitForSelector('.quote-card', { timeout: 5000 }).catch(() => fail(`${label}: notes did not render`));
  if (!(await page.locator('text=patient as stones').count())) fail(`${label}: strongest quote missing`);
  await page.click('text=No, it misread me');
  if (!(await page.locator('text=unclear on a first reading').count())) fail(`${label}: paraphrase mismatch message missing`);
  await page.click('text=Show me one possible version');
  await page.waitForSelector('text=in the model’s voice, not yours').catch(() => fail(`${label}: rewrite label missing`));
  await checkPage(page, '/desk', `${label}-judged`, errors);

  // Second piece so trends draw.
  await page.click('text=Clear desk');
  await page.fill('.desk-text', 'Short. Then a longer sentence follows it here. Short again.');
  await page.click('text=Save to portfolio');
  await page.goto(`${BASE}#/portfolio`);
  const pieces = await page.locator('.piece').count();
  if (pieces !== 2) fail(`${label}: expected 2 portfolio pieces, saw ${pieces}`);
  await checkPage(page, '/portfolio', `${label}-filled`, errors);
  await checkPage(page, '/telemetry', `${label}-filled`, errors);
  if (!(await page.locator('.trend').count())) fail(`${label}: trends missing`);

  await browser.close();
}

await run('desktop', { width: 1280, height: 900 }, 'light');
await run('mobile', { width: 390, height: 844 }, 'dark');
console.log(problems.length ? `\n${problems.length} problem(s)` : '\nAll clear.');
process.exit(problems.length ? 1 : 0);

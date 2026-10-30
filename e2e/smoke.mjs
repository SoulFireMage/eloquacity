// Playwright smoke pass: every page on desktop (light) and at 390px (dark),
// no console errors, no horizontal page scroll, and every judge path with
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
const PAGES = ['/', '/prose', '/desk', '/prose/shapeshifter', '/prose/ladders', '/prose/dial', '/prose/imitation', '/prose/restore', '/portfolio', '/telemetry', '/settings', '/account'];

const TEXT = [
  'The rain came. It did not stop.',
  'It fell on the roofs and the yards and the long grey road out of town, where the carts stood axle-deep and the horses waited with their heads down, patient as stones, while the drivers argued under the eaves about whether the bridge would hold.',
  'It held. Mostly.',
].join(' ');

// The app rejects quotes that aren't in the writer's text, so the mock builds its
// reply from what it was sent, like a well-behaved model would.
// Quote within a single clause, as the app requires verbatim phrases.
const clauses = (t) => t.split(/[.,;:!?—“”"()]+/).map((x) => x.trim()).filter(Boolean);
const firstWords = (t, n = 3) => (clauses(t)[0] ?? '').split(/\s+/).slice(0, n).join(' ');
const lastWords = (t, n = 2) => (clauses(t).at(-1) ?? '').split(/\s+/).slice(-n).join(' ');
const quotes = (t) => ({
  strongest: { quote: firstWords(t), why: 'The opening words carry the weight.' },
  weakest: { quote: lastWords(t), why: 'The ending trails a little.' },
});
const between = (s, a, b) => {
  const i = s.indexOf(a);
  if (i < 0) return '';
  const j = b ? s.indexOf(b, i + a.length) : -1;
  return s.slice(i + a.length, j < 0 ? undefined : j);
};

function mockReply(body) {
  const user = body.messages.find((m) => m.role === 'user')?.content ?? '';
  const name = body.response_format?.json_schema?.name ?? (/"heart"/.test(body.messages[0].content) ? 'ladder_notes' : /clause_order/.test(body.messages[0].content) ? 'imitation_notes' : /register_hit/.test(body.messages[0].content) ? 'dial_notes' : /aim_note/.test(body.messages[0].content) ? 'prose_notes' : '');
  if (name === 'prose_notes') {
    const text = between(user, 'TEXT:\n"""\n', '\n"""');
    const paraLines = between(user, 'SENTENCES TO PARAPHRASE', '\n\n').split('\n').filter((l) => /^\d+\. /.test(l));
    const checkLines = between(user, 'CHECKLIST', '\n\n').split('\n').filter((l) => /^\d+\. /.test(l));
    return {
      paraphrases: paraLines.map((l) => ({ n: Number(l.split('.')[0]), paraphrase: 'Something happens, plainly put.' })),
      ...quotes(text),
      aim_note: 'Close to the aim; the long sentence drifts.',
      checklist: checkLines.map((_, i) => ({ n: i + 1, answer: i === 0 ? 'partly' : 'yes' })),
    };
  }
  if (name === 'ladder_notes') {
    const rungs = user.split('\n').filter((l) => /^\d+\. \[target/.test(l)).map((l) => l.replace(/^\d+\. \[target [^\]]*\] /, ''));
    return { heart: 'Someone waits.', rungs: rungs.map((_, i) => ({ n: i + 1, alive: 'yes', heart_kept: i === 2 ? 'partly' : 'yes', why: 'Still moving.' })), paraphrase: 'A dog waits.', ...quotes(rungs[0]) };
  }
  if (name === 'imitation_notes') {
    const attempt = between(user, 'ATTEMPT: ', '\n');
    return { clause_order: { answer: 'yes', note: 'Same order.' }, pauses: { answer: 'partly', note: 'One pause moved.' }, weight: { answer: 'yes', note: 'Held to the end.' }, own_subject: 'yes', paraphrase: 'A plain reading.', ...quotes(attempt) };
  }
  if (name === 'dial_notes') {
    const blocks = user.split('"""').filter((_, i) => i % 2 === 1).map((b) => b.trim());
    return { rewrites: blocks.map((t, i) => ({ n: i + 1, register_hit: 'yes', under_control: i ? 'partly' : 'yes', note: 'On the setting.', paraphrase: 'A market opens and closes.', ...quotes(t) })) };
  }
  return null;
}

async function mockOpenRouter(page) {
  await page.route('https://openrouter.ai/**', async (route) => {
    const body = route.request().postDataJSON();
    const reply = mockReply(body);
    const content = reply ? JSON.stringify(reply) : 'One possible version, mocked.';
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
  await page.waitForSelector('.quote-card', { timeout: 5000 }).catch(async () => fail(`${label}: notes did not render: ${await page.locator('.notice.bad').allInnerTexts()}`));
  if (!(await page.locator('.quote-card blockquote', { hasText: 'The rain came' }).count())) fail(`${label}: strongest quote missing`);
  await page.click('text=Ambiguous on purpose');
  if (!(await page.locator('text=the ambiguity is yours on purpose').count())) fail(`${label}: ambiguous message missing`);
  await page.click('text=No, it misread me');
  if (!(await page.locator('text=unclear on a first reading').count())) fail(`${label}: paraphrase mismatch message missing`);
  await page.click('text=Show me one possible version');
  await page.waitForSelector('text=in the model’s voice, not yours').catch(() => fail(`${label}: rewrite label missing`));
  await checkPage(page, '/desk', `${label}-judged`, errors);

  const judged = async (what) => {
    await page.click('text=Get AI notes');
    await page.waitForSelector('.quote-card', { timeout: 5000 }).catch(() => fail(`${label}: ${what} notes did not render`));
    const err = await page.locator('.notice.bad').count();
    if (err) fail(`${label}: ${what}: ${await page.locator('.notice.bad').first().innerText()}`);
  };

  // Shapeshifter: a dealt shape, met exactly, then judged and saved.
  await page.evaluate(() => localStorage.setItem('eq.shape.v1', JSON.stringify({ target: 'short-short-long', subject: 'a power cut', text: '', attempt: 'a1' })));
  await page.goto(`${BASE}#/prose/shapeshifter`);
  await page.fill('.desk-text', 'The lights died. Nobody moved. Then somebody laughed in the dark, a small cracked laugh that went round the room like a candle being passed from hand to hand until all of us were laughing at nothing.');
  if (!(await page.locator('h2', { hasText: '✓ met' }).count())) fail(`${label}: shape not met`);
  if ((await page.locator('.ghost').count()) !== 3) fail(`${label}: ghost notes missing`);
  await judged('shapeshifter');
  await page.click('text=Ambiguous on purpose');
  await page.click('text=Save to portfolio');
  await checkPage(page, '/prose/shapeshifter', `${label}-judged`, errors);

  // Ladders: grow, three rungs in range.
  await page.evaluate(() => localStorage.setItem('eq.ladder.v1', JSON.stringify({ dir: 'grow', seed: 'The dog waited by the door.', source: '', rungs: ['', '', ''], attempt: 'l1' })));
  await page.goto(`${BASE}#/prose/ladders`);
  const ws = (n) => 'The ' + Array.from({ length: n - 2 }, () => 'dog').join(' ') + ' waited.';
  const rungs = page.locator('.rung textarea');
  await rungs.nth(0).fill(ws(20));
  await rungs.nth(1).fill(ws(40));
  await rungs.nth(2).fill(ws(62));
  if ((await page.locator('.rung-count.up').count()) !== 3) fail(`${label}: ladder rungs not all in range`);
  await judged('ladder');
  await page.click('text=Yes, that’s it');
  await checkPage(page, '/prose/ladders', `${label}-judged`, errors);

  // Register Dial: two settings, judged blind, meaning check against the source.
  await page.evaluate(() => localStorage.setItem('eq.dial.v1', JSON.stringify({ source: 'market', settings: [1, 5], texts: {}, attempt: 'd1' })));
  await page.goto(`${BASE}#/prose/dial`);
  const desks = page.locator('.dial-desk textarea');
  await desks.nth(0).fill('Market. Seven sharp. Crowds by eight. Rain at noon. Gone by four.');
  await desks.nth(1).fill('At seven the market unfurls like a peacock shaking out its jewelled tail, and by eight the street is a carnival of hands and voices.');
  await judged('dial');
  if ((await page.locator('.dial-notes').count()) !== 2) fail(`${label}: expected two dial notes`);
  await page.locator('button', { hasText: 'It drifted' }).first().click();
  if (!(await page.locator('text=The meaning drifted').count())) fail(`${label}: drift message missing`);
  await checkPage(page, '/prose/dial', `${label}-judged`, errors);

  // Imitation: staves and judged notes.
  await page.goto(`${BASE}#/prose/imitation`);
  await page.fill('.desk-text', 'Whenever the lift sticks, whenever the stairwell smells of rain, I take the long way round, slowly, counting the doors.');
  if (!(await page.locator('.stave-yours').count())) fail(`${label}: your stave missing`);
  await judged('imitation');
  await checkPage(page, '/prose/imitation', `${label}-judged`, errors);

  // Restore the Pause: add a pause and compare.
  await page.goto(`${BASE}#/prose/restore`);
  const ta = page.locator('.desk-text');
  const stripped = await ta.inputValue();
  await ta.fill(stripped.replace(' ', ', '));
  await page.click('text=Compare with the author');
  if (!(await page.locator('.marked').count())) fail(`${label}: restore comparison missing`);
  await checkPage(page, '/prose/restore', `${label}-compared`, errors);

  // A second Free Desk piece so trends draw (plus the Shapeshifter piece saved above).
  await page.goto(`${BASE}#/desk`);
  await page.click('text=Clear desk');
  await page.fill('.desk-text', 'Short. Then a longer sentence follows it here. Short again.');
  await page.click('text=Save to portfolio');
  await page.goto(`${BASE}#/portfolio`);
  const pieces = await page.locator('.piece').count();
  if (pieces !== 3) fail(`${label}: expected 3 portfolio pieces, saw ${pieces}`);
  await checkPage(page, '/portfolio', `${label}-filled`, errors);
  await checkPage(page, '/telemetry', `${label}-filled`, errors);
  if (!(await page.locator('.trend').count())) fail(`${label}: trends missing`);

  await browser.close();
}

await run('desktop', { width: 1280, height: 900 }, 'light');
await run('mobile', { width: 390, height: 844 }, 'dark');
console.log(problems.length ? `\n${problems.length} problem(s)` : '\nAll clear.');
process.exit(problems.length ? 1 : 0);

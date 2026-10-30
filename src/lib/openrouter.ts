// Bring-your-own-key OpenRouter client. The key lives only in this browser's
// localStorage and is sent only to openrouter.ai.

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class LlmError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

interface CallOpts {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: unknown;
  signal?: AbortSignal;
}

async function call(o: CallOpts): Promise<string> {
  if (!o.apiKey) throw new LlmError('No OpenRouter key set. Add one in Settings.');
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    signal: o.signal,
    headers: {
      Authorization: `Bearer ${o.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': location.origin,
      'X-Title': 'Eloquacity',
    },
    body: JSON.stringify({
      model: o.model,
      messages: o.messages,
      temperature: o.temperature ?? 0.7,
      ...(o.maxTokens ? { max_tokens: o.maxTokens } : {}),
      ...(o.responseFormat ? { response_format: o.responseFormat } : {}),
    }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.error) {
    const msg = body?.error?.message ?? `${res.status} ${res.statusText}`;
    throw new LlmError(`OpenRouter: ${msg}`, body?.error?.code ?? res.status);
  }
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new LlmError('The model returned an empty reply.');
  return content;
}

export function chat(o: Omit<CallOpts, 'responseFormat'>): Promise<string> {
  return call(o);
}

/** Pull the first balanced JSON object out of a reply that may include prose or code fences. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const src = fenced ? fenced[1] : text;
  const start = src.indexOf('{');
  if (start < 0) throw new Error('no JSON object found');
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return JSON.parse(src.slice(start, i + 1));
  }
  throw new Error('unterminated JSON object');
}

/**
 * Ask for JSON matching `schema`. Tries strict json_schema output first; models
 * that reject it fall back to json_object, then to plain text + extraction, with
 * one repair re-ask if parsing or `check` fails.
 */
export async function chatJson<T>(o: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
  /** Strict schemas need every property required and additionalProperties: false. */
  strict?: boolean;
  temperature?: number;
  maxTokens?: number;
  check?: (x: unknown) => string | null;
  signal?: AbortSignal;
}): Promise<T> {
  const messages: ChatMessage[] = [
    { role: 'system', content: `${o.system}\n\nReply with a single JSON object that matches this JSON Schema, and nothing else:\n${JSON.stringify(o.schema)}` },
    { role: 'user', content: o.user },
  ];
  const formats: unknown[] = [
    { type: 'json_schema', json_schema: { name: o.schemaName, strict: o.strict ?? true, schema: o.schema } },
    { type: 'json_object' },
    undefined,
  ];
  let reply = '';
  let lastErr: unknown;
  for (const responseFormat of formats) {
    try {
      reply = await call({ ...o, messages, temperature: o.temperature ?? 0.2, responseFormat });
      break;
    } catch (e) {
      lastErr = e;
      // Only fall through to a looser format when the request itself was rejected.
      if (!(e instanceof LlmError) || !(e.status === 400 || /response_format|json|schema|structured/i.test(e.message))) throw e;
    }
  }
  if (!reply) throw lastErr;

  const attempt = (text: string): { value?: T; problem?: string } => {
    try {
      const value = extractJson(text) as T;
      const problem = o.check?.(value) ?? null;
      return problem ? { problem } : { value };
    } catch (e) {
      return { problem: `Invalid JSON: ${(e as Error).message}` };
    }
  };
  const first = attempt(reply);
  if (first.value !== undefined) return first.value;

  const repaired = await call({
    ...o,
    temperature: 0,
    messages: [
      ...messages,
      { role: 'assistant', content: reply },
      { role: 'user', content: `That reply could not be used (${first.problem}). Return only the corrected JSON object.` },
    ],
  });
  const second = attempt(repaired);
  if (second.value !== undefined) return second.value;
  throw new LlmError(`The model's reply did not match the expected format (${second.problem}).`);
}

export interface ModelInfo {
  id: string;
  name: string;
}

/** Public model list (no key needed); used to suggest model IDs in Settings. */
export async function listModels(): Promise<ModelInfo[]> {
  const res = await fetch('https://openrouter.ai/api/v1/models');
  if (!res.ok) throw new Error(`Could not load models (${res.status})`);
  const body = await res.json();
  return (body?.data ?? []).map((m: any) => ({ id: m.id, name: m.name ?? m.id }));
}

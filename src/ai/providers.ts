/**
 * Plug-and-play LLM providers. Two wire formats cover almost everything:
 *  - Anthropic Messages API (Claude), with forced tool use for structured output
 *  - OpenAI-compatible Chat Completions (OpenAI, Gemini, Ollama, LM Studio, vLLM, OpenRouter, gateways…)
 */
export type ProviderId = 'demo' | 'anthropic' | 'openai' | 'gemini' | 'ollama' | 'lmstudio' | 'custom';

export interface ProviderDef {
  label: string;
  wire: 'demo' | 'anthropic' | 'openai';
  baseUrl: string;
  models: string[];
  key: 'required' | 'optional' | 'none';
  note?: string;
}

export const PROVIDERS: Record<ProviderId, ProviderDef> = {
  demo: { label: 'Demo (scripted, offline)', wire: 'demo', baseUrl: '', models: [], key: 'none' },
  anthropic: {
    label: 'Anthropic Claude',
    wire: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    models: ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'],
    key: 'required',
  },
  openai: { label: 'OpenAI', wire: 'openai', baseUrl: 'https://api.openai.com/v1', models: ['gpt-4o-mini'], key: 'required' },
  gemini: { label: 'Google Gemini', wire: 'openai', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', models: ['gemini-2.5-flash'], key: 'required' },
  ollama: { label: 'Ollama (local)', wire: 'openai', baseUrl: 'http://localhost:11434/v1', models: ['qwen2.5:7b', 'qwen2.5:14b'], key: 'none', note: 'Start with OLLAMA_ORIGINS="*" ollama serve' },
  lmstudio: { label: 'LM Studio (local)', wire: 'openai', baseUrl: 'http://localhost:1234/v1', models: [], key: 'none', note: 'Enable CORS in the LM Studio server settings' },
  custom: { label: 'Other OpenAI-compatible', wire: 'openai', baseUrl: '', models: [], key: 'optional', note: 'vLLM, OpenRouter, Azure gateway, in-house endpoint…' },
};

/** What the network layer needs for one call. */
export interface AIConfig {
  provider: ProviderId;
  baseUrl: string;
  model: string;
}

/**
 * What the user sets. Default: live, auto. With auto on, pasting a key picks the provider
 * (sk-ant- → Claude Haiku 5.5, AIza → Gemini, sk- → OpenAI); no key → local Ollama qwen2.5:7b.
 * "Advanced" turns auto off and exposes provider, endpoint and model.
 */
export interface AISettings {
  demo: boolean;
  auto: boolean;
  provider: ProviderId;
  baseUrl: string;
  model: string;
}

const env = import.meta.env;

export function defaultAISettings(): AISettings {
  const p = env.VITE_LLM_PROVIDER as ProviderId | undefined;
  if (p && p in PROVIDERS && p !== 'demo') {
    return { demo: false, auto: false, provider: p, baseUrl: (env.VITE_LLM_BASE_URL as string) || PROVIDERS[p].baseUrl, model: (env.VITE_LLM_MODEL as string) || PROVIDERS[p].models[0] || '' };
  }
  return { demo: p === 'demo', auto: true, provider: 'ollama', baseUrl: PROVIDERS.ollama.baseUrl, model: 'qwen2.5:7b' };
}

export function detectProvider(key: string): ProviderId {
  const k = key.trim();
  if (!k) return 'ollama';
  if (k.startsWith('sk-ant-')) return 'anthropic';
  if (k.startsWith('AIza')) return 'gemini';
  if (k.startsWith('sk-')) return 'openai';
  return 'anthropic';
}

/** Resolve settings + key into the concrete call config. */
export function effectiveConfig(s: AISettings, apiKey: string): AIConfig {
  if (s.demo) return { provider: 'demo', baseUrl: '', model: '' };
  if (!s.auto) return { provider: s.provider, baseUrl: s.baseUrl, model: s.model };
  const provider = detectProvider(apiKey);
  return { provider, baseUrl: PROVIDERS[provider].baseUrl, model: PROVIDERS[provider].models[0] ?? '' };
}

export function describeConfig(c: AIConfig): string {
  return c.provider === 'demo' ? 'Demo (scripted)' : `${PROVIDERS[c.provider].label} · ${c.model}`;
}

export const ENV_API_KEY = (env.VITE_LLM_API_KEY as string) || '';

export interface CallSpec {
  system: string;
  user: string;
  schema: Record<string, unknown>;
  label: string;
}

/** Pull the first JSON object out of a model reply (handles ```json fences and chatter). */
export function extractJSON(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('The model did not return JSON.');
  return JSON.parse(body.slice(start, end + 1));
}

async function failure(res: Response, who: string): Promise<Error> {
  let msg = `${res.status} ${res.statusText}`;
  try {
    const j = await res.json();
    msg = j?.error?.message ?? j?.message ?? msg;
  } catch {
    /* keep status */
  }
  return new Error(`${who}: ${msg}`);
}

export async function callLLM(cfg: AIConfig, apiKey: string, spec: CallSpec): Promise<{ data: any; model: string }> {
  const def = PROVIDERS[cfg.provider];
  const base = cfg.baseUrl.replace(/\/+$/, '');
  if (!cfg.model) throw new Error('Choose a model in Settings.');
  if (def.key === 'required' && !apiKey) throw new Error(`Add your ${def.label} API key in Settings.`);

  if (def.wire === 'anthropic') {
    const res = await fetch(`${base}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: 4096,
        system: spec.system,
        messages: [{ role: 'user', content: spec.user }],
        tools: [{ name: 'respond', description: `Return the result of: ${spec.label}`, input_schema: spec.schema }],
        tool_choice: { type: 'tool', name: 'respond' },
      }),
    });
    if (!res.ok) throw await failure(res, def.label);
    const body = await res.json();
    const block = body?.content?.find((b: any) => b.type === 'tool_use');
    if (!block) throw new Error(`${def.label} returned no structured result.`);
    return { data: block.input, model: body.model ?? cfg.model };
  }

  // OpenAI-compatible
  const messages = [
    { role: 'system', content: `${spec.system}\nRespond with ONLY a JSON object (no prose, no code fences) that matches this JSON Schema:\n${JSON.stringify(spec.schema)}` },
    { role: 'user', content: spec.user },
  ];
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  const send = (jsonMode: boolean) =>
    fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: cfg.model, messages, temperature: 0.2, ...(jsonMode ? { response_format: { type: 'json_object' } } : {}) }),
    });
  let res: Response;
  try {
    res = await send(true);
    // Some local servers reject response_format — retry without it.
    if (res.status === 400 || res.status === 422) res = await send(false);
  } catch (e) {
    throw new Error(
      cfg.provider === 'ollama'
        ? `No local model at ${base}. Paste an API key in Settings, or start Ollama with OLLAMA_ORIGINS="*" ollama serve.`
        : `${def.label}: can’t reach ${base}. Check the endpoint and that it allows browser (CORS) requests.`,
    );
  }
  if (!res.ok) throw await failure(res, def.label);
  const body = await res.json();
  const text: string = body?.choices?.[0]?.message?.content ?? '';
  return { data: extractJSON(text), model: body.model ?? cfg.model };
}

export async function testConnection(cfg: AIConfig, apiKey: string): Promise<string> {
  const t0 = performance.now();
  const r = await callLLM(cfg, apiKey, {
    label: 'connection test',
    system: 'You are a connection test.',
    user: 'Return {"ok": true}.',
    schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
  });
  if (r.data?.ok !== true) throw new Error('Connected, but the reply was not the expected JSON.');
  return `Connected to ${r.model} in ${((performance.now() - t0) / 1000).toFixed(1)} s`;
}

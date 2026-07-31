import { AppConfig, ChatMessage, Provider, ProviderResponse, ToolDefinition } from '../types.js';

const NVIDIA_NIM_BASE_URL = 'https://integrate.api.nvidia.com/v1';

export class NvidiaProvider implements Provider {
  name = 'nvidia' as const;
  constructor(private config: AppConfig) {}

  async complete(messages: ChatMessage[], tools: ToolDefinition[]): Promise<ProviderResponse> {
    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) throw new Error('NVIDIA_API_KEY is not set');
    const url = `${NVIDIA_NIM_BASE_URL}/chat/completions`;
    const body = {
      model: this.config.nvidiaModel,
      messages: normalizeMessages(messages),
      tools: tools.map(t => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.inputSchema }
      })),
      tool_choice: 'auto',
      temperature: 0.2
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`NVIDIA NIM API ${res.status}: ${await res.text()}`);
    const json: any = await res.json();
    const msg = json.choices?.[0]?.message || {};
    const text = msg.content || '';
    const toolCalls = (msg.tool_calls || []).map((tc: any) => ({
      id: tc.id || `${tc.function?.name}-${Date.now()}`,
      name: tc.function?.name,
      input: parseArgs(tc.function?.arguments)
    })).filter((x: any) => x.name);
    return { text, toolCalls, raw: json };
  }
}

function parseArgs(s: string): Record<string, unknown> {
  try { return JSON.parse(s || '{}'); } catch { return { raw: s }; }
}

function normalizeMessages(messages: ChatMessage[]): any[] {
  return messages.map(m => {
    if (m.role === 'tool') return { role: 'user', content: `Tool result from ${m.name}:\n${m.content}` };
    return { role: m.role, content: m.content };
  });
}

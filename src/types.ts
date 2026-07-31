export type ProviderName = 'anthropic' | 'openai' | 'nvidia';

export interface AppConfig {
  provider: ProviderName;
  anthropicModel: string;
  openaiModel: string;
  openaiBaseUrl: string;
  nvidiaModel: string;
  maxToolRounds: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  danger: 'safe' | 'write' | 'shell';
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ProviderResponse {
  text: string;
  toolCalls: ToolCall[];
  raw?: unknown;
}

export interface Provider {
  name: ProviderName;
  complete(messages: ChatMessage[], tools: ToolDefinition[]): Promise<ProviderResponse>;
}

export interface ToolContext {
  root: string;
  yes: boolean;
}

export interface ToolResult {
  ok: boolean;
  output: string;
}

import { AppConfig, Provider } from '../types.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';

export function createProvider(config: AppConfig): Provider {
  if (config.provider === 'openai') return new OpenAIProvider(config);
  return new AnthropicProvider(config);
}

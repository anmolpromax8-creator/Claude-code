import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';
export function createProvider(config) {
    if (config.provider === 'openai')
        return new OpenAIProvider(config);
    return new AnthropicProvider(config);
}

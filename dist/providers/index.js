import { AnthropicProvider } from './anthropic.js';
import { NvidiaProvider } from './nvidia.js';
import { OpenAIProvider } from './openai.js';
export function createProvider(config) {
    if (config.provider === 'openai')
        return new OpenAIProvider(config);
    if (config.provider === 'nvidia')
        return new NvidiaProvider(config);
    return new AnthropicProvider(config);
}

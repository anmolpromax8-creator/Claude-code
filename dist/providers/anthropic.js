export class AnthropicProvider {
    config;
    name = 'anthropic';
    constructor(config) {
        this.config = config;
    }
    async complete(messages, tools) {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey)
            throw new Error('ANTHROPIC_API_KEY is not set');
        const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
        const nonSystem = normalizeMessages(messages.filter(m => m.role !== 'system'));
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                model: this.config.anthropicModel,
                max_tokens: 4096,
                system,
                messages: nonSystem,
                tools: tools.map(t => ({ name: t.name, description: t.description, input_schema: t.inputSchema }))
            })
        });
        if (!res.ok)
            throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
        const json = await res.json();
        let text = '';
        const toolCalls = [];
        for (const part of json.content || []) {
            if (part.type === 'text')
                text += part.text || '';
            if (part.type === 'tool_use')
                toolCalls.push({ id: part.id, name: part.name, input: part.input || {} });
        }
        return { text, toolCalls, raw: json };
    }
}
function normalizeMessages(messages) {
    const out = [];
    for (const m of messages) {
        if (m.role === 'tool')
            out.push({ role: 'user', content: `Tool result from ${m.name}:\n${m.content}` });
        else
            out.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });
    }
    // Anthropic requires alternating-ish user/assistant; merge consecutive same-role messages.
    const merged = [];
    for (const m of out) {
        const last = merged[merged.length - 1];
        if (last && last.role === m.role)
            last.content += `\n\n${m.content}`;
        else
            merged.push({ ...m });
    }
    if (merged.length === 0 || merged[0].role !== 'user')
        merged.unshift({ role: 'user', content: 'Begin.' });
    return merged;
}

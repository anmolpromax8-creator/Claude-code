import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
export const defaultConfig = {
    provider: process.env.CCODE_PROVIDER || 'anthropic',
    anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest',
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    openaiBaseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    nvidiaModel: process.env.NVIDIA_MODEL || 'nvidia/llama-3.1-nemotron-ultra-253b-v1',
    maxToolRounds: Number(process.env.CCODE_MAX_TOOL_ROUNDS || 12)
};
export function configDir() {
    return path.join(os.homedir(), '.ccode');
}
export function configPath() {
    return path.join(configDir(), 'config.json');
}
export function keyStorePath() {
    return path.join(configDir(), 'keys.json');
}
export async function loadConfig() {
    try {
        const raw = await fs.readFile(configPath(), 'utf8');
        return { ...defaultConfig, ...JSON.parse(raw) };
    }
    catch {
        return defaultConfig;
    }
}
export async function saveConfig(config) {
    await fs.mkdir(configDir(), { recursive: true, mode: 0o700 });
    await fs.writeFile(configPath(), JSON.stringify(config, null, 2));
}
export async function setConfigValue(key, value) {
    const config = await loadConfig();
    if (key === 'maxToolRounds')
        config[key] = Number(value);
    else
        config[key] = value;
    await saveConfig(config);
    return config;
}
export function envNameForProvider(provider) {
    if (provider === 'anthropic')
        return 'ANTHROPIC_API_KEY';
    if (provider === 'nvidia')
        return 'NVIDIA_API_KEY';
    return 'OPENAI_API_KEY';
}
export async function loadSavedApiKeys() {
    try {
        const raw = await fs.readFile(keyStorePath(), 'utf8');
        return JSON.parse(raw);
    }
    catch {
        return {};
    }
}
export async function hydrateEnvFromSavedKeys() {
    const keys = await loadSavedApiKeys();
    for (const [name, value] of Object.entries(keys)) {
        if (value && !process.env[name])
            process.env[name] = value;
    }
}
export async function saveApiKey(envName, value) {
    await fs.mkdir(configDir(), { recursive: true, mode: 0o700 });
    const keys = await loadSavedApiKeys();
    keys[envName] = value;
    await fs.writeFile(keyStorePath(), JSON.stringify(keys, null, 2), { mode: 0o600 });
    try {
        await fs.chmod(keyStorePath(), 0o600);
    }
    catch { }
}
export async function deleteSavedApiKey(envName) {
    const keys = await loadSavedApiKeys();
    delete keys[envName];
    await fs.mkdir(configDir(), { recursive: true, mode: 0o700 });
    await fs.writeFile(keyStorePath(), JSON.stringify(keys, null, 2), { mode: 0o600 });
    try {
        await fs.chmod(keyStorePath(), 0o600);
    }
    catch { }
}

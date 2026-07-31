import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { AppConfig } from './types.js';

export const defaultConfig: AppConfig = {
  provider: (process.env.CCODE_PROVIDER as any) || 'anthropic',
  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  openaiBaseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  nvidiaModel: process.env.NVIDIA_MODEL || 'nvidia/llama-3.1-nemotron-ultra-253b-v1',
  maxToolRounds: Number(process.env.CCODE_MAX_TOOL_ROUNDS || 12)
};

export function configDir(): string {
  return path.join(os.homedir(), '.ccode');
}

export function configPath(): string {
  return path.join(configDir(), 'config.json');
}

export async function loadConfig(): Promise<AppConfig> {
  try {
    const raw = await fs.readFile(configPath(), 'utf8');
    return { ...defaultConfig, ...JSON.parse(raw) };
  } catch {
    return defaultConfig;
  }
}

export async function saveConfig(config: AppConfig): Promise<void> {
  await fs.mkdir(configDir(), { recursive: true });
  await fs.writeFile(configPath(), JSON.stringify(config, null, 2));
}

export async function setConfigValue(key: keyof AppConfig, value: string): Promise<AppConfig> {
  const config: any = await loadConfig();
  if (key === 'maxToolRounds') config[key] = Number(value);
  else config[key] = value;
  await saveConfig(config);
  return config;
}

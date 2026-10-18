import { GoogleGenAI } from '@google/genai';
import { type AiProvider, type GenerateTextParams } from './provider.interface';
import { logger } from '../../shared/logger/logger';
import { AppError } from '../../shared/errors/AppError';

export interface GeminiProviderConfig {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
}

export class GeminiAiProvider implements AiProvider {
  readonly name = 'gemini';
  private client: GoogleGenAI | null = null;
  private apiKey: string | null = null;
  private modelName: string;
  private timeoutMs: number;

  constructor(config: GeminiProviderConfig = {}) {
    const key = config.apiKey || process.env.GEMINI_API_KEY || process.env.AI_API_KEY || '';
    this.modelName = config.model || 'gemini-1.5-flash';
    this.timeoutMs = config.timeoutMs || 10000;

    if (key && key.trim().length > 0 && key !== '••••••••') {
      this.apiKey = key.trim();
      this.client = new GoogleGenAI({ apiKey: this.apiKey });
    }
  }

  async isConfigured(): Promise<boolean> {
    return Boolean(this.client && this.apiKey && this.apiKey.length > 5);
  }

  async generateText(params: GenerateTextParams): Promise<string> {
    if (!this.client || !this.apiKey) {
      throw new AppError(
        'AI Assistant is not configured. Please configure a valid API key in System Settings or via GEMINI_API_KEY.',
        503,
        'AI_NOT_CONFIGURED'
      );
    }

    const abortController = new AbortController();
    const timer = setTimeout(() => {
      abortController.abort();
    }, this.timeoutMs);

    try {
      const callPromise = this.client.models.generateContent({
        model: this.modelName,
        contents: params.prompt,
        config: {
          systemInstruction: params.systemInstruction,
          temperature: params.temperature ?? 0.2,
          maxOutputTokens: params.maxTokens ?? 1024,
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        abortController.signal.addEventListener('abort', () => {
          reject(new AppError('AI provider request timed out after 10 seconds', 504, 'AI_TIMEOUT'));
        });
      });

      const response = await Promise.race([callPromise, timeoutPromise]);
      const text = response.text;

      if (!text || typeof text !== 'string') {
        throw new AppError(
          'AI provider returned an empty or invalid response',
          502,
          'AI_BAD_RESPONSE'
        );
      }

      return text.trim();
    } catch (err: unknown) {
      if (err instanceof AppError) {
        throw err;
      }

      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('[GeminiAiProvider] Execution failed', {
        error: errorMessage.replace(this.apiKey, '[REDACTED_KEY]'),
        model: this.modelName,
      });

      if (
        errorMessage.includes('429') ||
        errorMessage.toLowerCase().includes('quota') ||
        errorMessage.toLowerCase().includes('rate limit')
      ) {
        throw new AppError(
          'AI Operations Assistant quota or rate limit exceeded. Please retry in a few moments.',
          429,
          'AI_RATE_LIMITED'
        );
      }

      throw new AppError(
        'Failed to generate response from AI Operations Assistant. Upstream provider error.',
        502,
        'AI_PROVIDER_ERROR'
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

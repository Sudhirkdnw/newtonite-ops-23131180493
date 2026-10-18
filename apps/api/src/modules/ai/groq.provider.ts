import Groq from 'groq-sdk';
import { type AiProvider, type GenerateTextParams } from './provider.interface';
import { logger } from '../../shared/logger/logger';
import { AppError } from '../../shared/errors/AppError';

export interface GroqProviderConfig {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
}

export class GroqAiProvider implements AiProvider {
  readonly name = 'groq';
  private client: Groq | null = null;
  private apiKey: string | null = null;
  private modelName: string;
  private timeoutMs: number;

  constructor(config: GroqProviderConfig = {}) {
    const key =
      config.apiKey !== undefined
        ? config.apiKey
        : process.env.GROQ_API_KEY || process.env.AI_API_KEY || '';
    this.modelName = config.model || 'llama-3.3-70b-versatile';
    this.timeoutMs = config.timeoutMs || 10000;

    if (key && key.trim().length > 0 && key !== '••••••••') {
      this.apiKey = key.trim();
      this.client = new Groq({ apiKey: this.apiKey });
    }
  }

  async isConfigured(): Promise<boolean> {
    return Boolean(this.client && this.apiKey && this.apiKey.length > 5);
  }

  async generateText(params: GenerateTextParams): Promise<string> {
    if (!this.client || !this.apiKey) {
      throw new AppError(
        'AI Assistant is not configured. Please configure a valid Groq API key in System Settings or via GROQ_API_KEY.',
        503,
        'AI_NOT_CONFIGURED'
      );
    }

    const abortController = new AbortController();
    const timer = setTimeout(() => {
      abortController.abort();
    }, this.timeoutMs);

    try {
      let text: string | null | undefined = null;

      try {
        const response = await this.client.chat.completions.create(
          {
            model: this.modelName,
            messages: [
              {
                role: 'system',
                content: params.systemInstruction,
              },
              {
                role: 'user',
                content: params.prompt,
              },
            ],
            temperature: params.temperature ?? 0.2,
            max_completion_tokens: params.maxTokens ?? 1024,
          },
          {
            signal: abortController.signal,
          }
        );
        text = response.choices?.[0]?.message?.content;
      } catch (firstErr: unknown) {
        const firstMsg = firstErr instanceof Error ? firstErr.message : String(firstErr);
        const isModelMissing =
          firstMsg.includes('model_not_found') ||
          firstMsg.toLowerCase().includes('does not exist or you do not have access') ||
          firstMsg.includes('404');

        if (isModelMissing) {
          const candidateModels = [
            'openai/gpt-oss-120b',
            'openai/gpt-oss-20b',
            'llama-3.1-8b-instant',
            'allam-2-7b',
          ].filter((m) => m !== this.modelName);

          let fallbackSuccess = false;
          for (const fallbackModel of candidateModels) {
            try {
              logger.warn(
                `[GroqAiProvider] Model '${this.modelName}' not found or restricted. Retrying with fallback model '${fallbackModel}'...`
              );
              const fallbackResponse = await this.client.chat.completions.create(
                {
                  model: fallbackModel,
                  messages: [
                    {
                      role: 'system',
                      content: params.systemInstruction,
                    },
                    {
                      role: 'user',
                      content: params.prompt,
                    },
                  ],
                  temperature: params.temperature ?? 0.2,
                  max_completion_tokens: Math.min(params.maxTokens ?? 1024, 1024),
                },
                {
                  signal: abortController.signal,
                }
              );
              text = fallbackResponse.choices?.[0]?.message?.content;
              fallbackSuccess = true;
              break;
            } catch {
              // try next candidate
            }
          }

          if (!fallbackSuccess) {
            throw firstErr;
          }
        } else {
          throw firstErr;
        }
      }

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
      logger.error('[GroqAiProvider] Execution failed', {
        error: errorMessage.replace(this.apiKey, '[REDACTED_KEY]'),
        model: this.modelName,
      });

      if (
        errorMessage.includes('429') ||
        errorMessage.toLowerCase().includes('rate limit') ||
        errorMessage.toLowerCase().includes('quota')
      ) {
        throw new AppError(
          'Groq AI Operations Assistant quota or rate limit exceeded. Please retry in a few moments.',
          429,
          'AI_RATE_LIMITED'
        );
      }

      if (errorMessage.includes('timeout') || errorMessage.toLowerCase().includes('abort')) {
        throw new AppError('AI provider request timed out after 10 seconds', 504, 'AI_TIMEOUT');
      }

      if (
        errorMessage.includes('model_not_found') ||
        errorMessage.toLowerCase().includes('does not exist or you do not have access')
      ) {
        throw new AppError(
          `Groq model '${this.modelName}' does not exist or your Groq API key does not have access to it. Please select 'llama-3.1-8b-instant' in Settings -> AI Configuration.`,
          404,
          'AI_MODEL_NOT_FOUND'
        );
      }

      throw new AppError(
        `Failed to generate response from Groq AI Operations Assistant: ${errorMessage.replace(this.apiKey, '[REDACTED_KEY]')}`,
        502,
        'AI_PROVIDER_ERROR'
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

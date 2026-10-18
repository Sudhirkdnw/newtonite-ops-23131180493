export interface GenerateTextParams {
  systemInstruction: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AiProvider {
  readonly name: string;
  isConfigured(): Promise<boolean>;
  generateText(params: GenerateTextParams): Promise<string>;
}

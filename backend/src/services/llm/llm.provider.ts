export interface LLMGenerateOptions {
  prompt: string
  model?: string
}

export interface LLMResponse {
  text: string
  model: string
  tokensUsed?: number
}

export interface LLMProvider {
  readonly name: string
  readonly defaultModel: string
  isAvailable(): boolean
  generate(options: LLMGenerateOptions): Promise<LLMResponse>
  stream(options: LLMGenerateOptions): AsyncIterable<string>
}

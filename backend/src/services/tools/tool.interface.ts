export interface ToolInput {
  [key: string]: any
}

export interface ToolResult {
  success: boolean
  output: string
  metadata?: Record<string, any>
  error?: string
}

export interface ToolContext {
  userId: string
  knowledgeId?: string
}

export interface AiTool {
  readonly name: string
  readonly description: string
  readonly inputSchema: Record<string, { type: string; required: boolean; description: string }>
  validate(input: ToolInput): { valid: boolean; errors: string[] }
  execute(input: ToolInput, context: ToolContext): Promise<ToolResult>
}

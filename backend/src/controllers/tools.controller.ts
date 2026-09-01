import { Response } from "express"
import { AuthRequest } from "../middleware/auth.middleware"
import { getTool, listTools } from "../services/tools/tool.registry"
import { logger } from "../utils/logger"

export const getToolsList = async (
  _req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const list = listTools()
    res.status(200).json({
      success: true,
      count: list.length,
      tools: list,
    })
  } catch (error) {
    logger.error("[TOOLS] Failed to list tools:", error)
    res.status(500).json({
      success: false,
      message: "Failed to list workspace tools",
    })
  }
}

export const executeTool = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const toolName = req.params.toolName as string
    const tool = getTool(toolName)

    if (!tool) {
      res.status(404).json({
        success: false,
        message: `Tool "${toolName}" not found.`,
      })
      return
    }

    const { valid, errors } = tool.validate(req.body)
    if (!valid) {
      res.status(400).json({
        success: false,
        message: "Invalid tool inputs",
        errors,
      })
      return
    }

    const userId = req.user!.id
    const knowledgeId = req.body.knowledgeId as string | undefined

    logger.info(`[TOOLS] Executing tool "${toolName}" for user "${userId}"`)
    const result = await tool.execute(req.body, { userId, knowledgeId })

    if (!result.success) {
      res.status(500).json({
        success: false,
        message: result.error || "Tool execution failed",
      })
      return
    }

    res.status(200).json(result)
  } catch (error) {
    logger.error("[TOOLS] Tool execution error:", error)
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal tool execution error",
    })
  }
}

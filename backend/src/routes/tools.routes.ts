import { Router } from "express"
import { protect } from "../middleware/auth.middleware"
import { getToolsList, executeTool } from "../controllers/tools.controller"

const router = Router()

router.use(protect)

router.get("/", getToolsList)
router.post("/:toolName", executeTool)

export default router

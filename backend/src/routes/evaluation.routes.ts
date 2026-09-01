import { Router } from "express"
import { protect } from "../middleware/auth.middleware"
import { getEvaluationStats, runManualEvaluation } from "../controllers/evaluation.controller"

const router = Router()

router.use(protect)

router.get("/stats", getEvaluationStats)
router.post("/run", runManualEvaluation)

export default router

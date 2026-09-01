import { Router } from "express"
import { protect } from "../middleware/auth.middleware"
import { submitFeedback, getMessageFeedback } from "../controllers/feedback.controller"

const router = Router()

router.use(protect)

router.post("/", submitFeedback)
router.get("/message/:messageId", getMessageFeedback)

export default router

import { Router } from "express"
import { protect } from "../middleware/auth.middleware"
import {
  generateApiKey,
  listUserApiKeys,
  revokeApiKey,
  rotateApiKey,
} from "../services/apikey.service"
import { getUsageOverview } from "../services/usage.service"

const router = Router()

router.use(protect)

// 1. Create API key
router.post("/", async (req: any, res) => {
  try {
    const { name, permissions } = req.body
    if (!name) {
      res.status(400).json({ success: false, message: "API Key name is required" })
      return
    }

    const { apiKeyRecord, rawKey } = await generateApiKey(req.user.id, name, permissions)

    res.status(201).json({
      success: true,
      message: "API Key created successfully. Save it now, you will not be able to see it again.",
      apiKey: {
        _id: apiKeyRecord._id,
        name: apiKeyRecord.name,
        keyMasked: apiKeyRecord.keyMasked,
        permissions: apiKeyRecord.permissions,
        isActive: apiKeyRecord.isActive,
        createdAt: apiKeyRecord.createdAt,
      },
      rawKey,
    })
  } catch (error) {
    console.error("Create API Key error:", error)
    res.status(500).json({ success: false, message: "Failed to generate API Key" })
  }
})

// 2. List user API keys
router.get("/", async (req: any, res) => {
  try {
    const keys = await listUserApiKeys(req.user.id)
    res.status(200).json({ success: true, apiKeys: keys })
  } catch (error) {
    console.error("List API Keys error:", error)
    res.status(500).json({ success: false, message: "Failed to list API Keys" })
  }
})

// 3. Revoke API key
router.delete("/:id", async (req: any, res) => {
  try {
    const success = await revokeApiKey(req.params.id, req.user.id)
    if (!success) {
      res.status(404).json({ success: false, message: "API Key not found or unauthorized" })
      return
    }
    res.status(200).json({ success: true, message: "API Key revoked successfully" })
  } catch (error) {
    console.error("Revoke API Key error:", error)
    res.status(500).json({ success: false, message: "Failed to revoke API Key" })
  }
})

// 4. Rotate API key
router.post("/:id/rotate", async (req: any, res) => {
  try {
    const result = await rotateApiKey(req.params.id, req.user.id)
    if (!result) {
      res.status(404).json({ success: false, message: "API Key not found or unauthorized" })
      return
    }
    res.status(200).json({
      success: true,
      message: "API Key rotated successfully. Save it now, you will not be able to see it again.",
      apiKey: {
        _id: result.apiKeyRecord._id,
        name: result.apiKeyRecord.name,
        keyMasked: result.apiKeyRecord.keyMasked,
        permissions: result.apiKeyRecord.permissions,
        isActive: result.apiKeyRecord.isActive,
        createdAt: result.apiKeyRecord.createdAt,
      },
      rawKey: result.rawKey,
    })
  } catch (error) {
    console.error("Rotate API Key error:", error)
    res.status(500).json({ success: false, message: "Failed to rotate API Key" })
  }
})

// 5. Get plan usage overview
router.get("/usage/overview", async (req: any, res) => {
  try {
    const overview = await getUsageOverview(req.user.id)
    res.status(200).json({ success: true, overview })
  } catch (error) {
    console.error("Get usage overview error:", error)
    res.status(500).json({ success: false, message: "Failed to get usage overview" })
  }
})

export default router

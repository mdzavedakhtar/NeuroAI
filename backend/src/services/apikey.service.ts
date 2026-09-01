import crypto from "crypto"
import ApiKey, { IApiKey } from "../models/ApiKey"
import User from "../models/User"

function hashKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex")
}

export interface IGeneratedKey {
  apiKeyRecord: IApiKey
  rawKey: string
}

export async function generateApiKey(
  userId: string,
  name: string,
  permissions: string[] = ["read", "write"]
): Promise<IGeneratedKey> {
  const prefix = "ns"
  const randomBytes = crypto.randomBytes(16).toString("hex") // 32 chars
  const rawKey = `${prefix}_${randomBytes}`
  const keyHash = hashKey(rawKey)
  const keyMasked = `${prefix}_...${rawKey.slice(-4)}`

  const apiKeyRecord = await ApiKey.create({
    user: userId,
    name,
    keyHash,
    keyPrefix: prefix,
    keyMasked,
    permissions,
  })

  return { apiKeyRecord, rawKey }
}

export async function validateApiKey(rawKey: string) {
  if (!rawKey) return null

  const keyHash = hashKey(rawKey)
  const keyRecord = await ApiKey.findOne({ keyHash, isActive: true }).populate("user")
  if (!keyRecord) return null

  // Update lastUsedAt asynchronously
  ApiKey.updateOne({ _id: keyRecord._id }, { $set: { lastUsedAt: new Date() } }).catch((err) => {
    console.error("Failed to update lastUsedAt for API key:", err)
  })

  return keyRecord
}

export async function listUserApiKeys(userId: string): Promise<IApiKey[]> {
  return ApiKey.find({ user: userId }).sort({ createdAt: -1 }).lean()
}

export async function revokeApiKey(keyId: string, userId: string): Promise<boolean> {
  const result = await ApiKey.deleteOne({ _id: keyId, user: userId })
  return result.deletedCount > 0
}

export async function rotateApiKey(keyId: string, userId: string): Promise<IGeneratedKey | null> {
  const keyRecord = await ApiKey.findOne({ _id: keyId, user: userId })
  if (!keyRecord) return null

  const prefix = "ns"
  const randomBytes = crypto.randomBytes(16).toString("hex")
  const rawKey = `${prefix}_${randomBytes}`
  const keyHash = hashKey(rawKey)
  const keyMasked = `${prefix}_...${rawKey.slice(-4)}`

  keyRecord.keyHash = keyHash
  keyRecord.keyMasked = keyMasked
  keyRecord.isActive = true
  await keyRecord.save()

  return { apiKeyRecord: keyRecord, rawKey }
}

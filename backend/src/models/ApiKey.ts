import mongoose, { Document, Model, Schema, Types } from "mongoose"

export interface IApiKey extends Document {
  user: Types.ObjectId
  name: string
  keyHash: string
  keyPrefix: string
  keyMasked: string
  isActive: boolean
  permissions: string[]
  lastUsedAt?: Date
  createdAt: Date
  updatedAt: Date
}

const apiKeySchema = new Schema<IApiKey>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Key name is required"],
      trim: true,
      maxlength: 100,
    },
    keyHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    keyPrefix: {
      type: String,
      required: true,
    },
    keyMasked: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    permissions: {
      type: [String],
      default: ["read", "write"],
    },
    lastUsedAt: {
      type: Date,
      default: undefined,
    },
  },
  {
    timestamps: true,
  }
)

const ApiKey: Model<IApiKey> =
  mongoose.models.ApiKey || mongoose.model<IApiKey>("ApiKey", apiKeySchema)

export default ApiKey

import mongoose, { Document, Model, Schema, Types } from "mongoose"

export interface IUserUsage extends Document {
  user: Types.ObjectId
  requestsCount: number
  aiGenerationsCount: number
  tokensCount: number
  periodStart: Date
  periodEnd: Date
  createdAt: Date
  updatedAt: Date
}

const userUsageSchema = new Schema<IUserUsage>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    requestsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    aiGenerationsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    tokensCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    periodStart: {
      type: Date,
      default: Date.now,
    },
    periodEnd: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default window
    },
  },
  {
    timestamps: true,
  }
)

const UserUsage: Model<IUserUsage> =
  mongoose.models.UserUsage || mongoose.model<IUserUsage>("UserUsage", userUsageSchema)

export default UserUsage

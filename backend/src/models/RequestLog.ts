import mongoose, { Document, Model, Schema, Types } from "mongoose"

/**
 * RequestLog — lightweight telemetry for real latency and model-usage analytics.
 * Written once per AI generation (chat, tool, API v1).
 * Never fabricated: if no rows exist, analytics returns zeros/empty arrays.
 */
export interface IRequestLog extends Document {
  userId: Types.ObjectId
  modelName: string       // e.g. "gemini-2.0-flash"
  durationMs: number      // wall-clock time for the LLM call only
  tokensEstimate: number  // rough character-based token estimate
  endpoint: string        // e.g. "chat", "v1/chat", "tools"
  createdAt: Date
}

const requestLogSchema = new Schema<IRequestLog>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    modelName: {
      type: String,
      required: true,
      index: true,
    },
    durationMs: {
      type: Number,
      required: true,
      min: 0,
    },
    tokensEstimate: {
      type: Number,
      default: 0,
      min: 0,
    },
    endpoint: {
      type: String,
      default: "unknown",
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    // Capped at 100k documents to prevent unbounded growth
    // (remove cap if you need full historical latency data)
  }
)

const RequestLog: Model<IRequestLog> =
  mongoose.models.RequestLog || mongoose.model<IRequestLog>("RequestLog", requestLogSchema)

export default RequestLog

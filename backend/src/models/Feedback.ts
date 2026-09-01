import mongoose, { Schema, Document, Types } from "mongoose"

export interface IFeedback extends Document {
  userId: Types.ObjectId
  conversationId: Types.ObjectId
  messageId: Types.ObjectId
  rating: "helpful" | "not_helpful"
  reason?: string
  createdAt: Date
}

const feedbackSchema = new Schema<IFeedback>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    messageId: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      required: true,
      index: true,
    },
    rating: {
      type: String,
      enum: ["helpful", "not_helpful"],
      required: true,
    },
    reason: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
)

// Ensure one feedback rating per message from a user
feedbackSchema.index({ userId: 1, messageId: 1 }, { unique: true })

export default mongoose.model<IFeedback>("Feedback", feedbackSchema)

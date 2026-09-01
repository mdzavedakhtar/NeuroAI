import mongoose, { Schema, Document, Types } from "mongoose"

export interface IRagEvaluation extends Document {
  userId: Types.ObjectId
  knowledgeId?: Types.ObjectId
  question: string
  context: string
  answer: string
  contextRelevance: number // 0 to 1
  answerRelevance: number // 0 to 1
  faithfulness: number // 0 to 1
  averageScore: number // 0 to 1
  createdAt: Date
}

const ragEvaluationSchema = new Schema<IRagEvaluation>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    knowledgeId: {
      type: Schema.Types.ObjectId,
      ref: "Knowledge",
      required: false,
    },
    question: {
      type: String,
      required: true,
    },
    context: {
      type: String,
      required: true,
    },
    answer: {
      type: String,
      required: true,
    },
    contextRelevance: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    answerRelevance: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    faithfulness: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    averageScore: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
)

export default mongoose.model<IRagEvaluation>("RagEvaluation", ragEvaluationSchema)

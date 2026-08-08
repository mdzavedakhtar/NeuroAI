import mongoose, {
  Document,
  Model,
  Schema,
  Types,
} from "mongoose"

export type KnowledgeStatus =
  | "uploaded"
  | "processing"
  | "ready"
  | "failed"

export interface IKnowledge extends Document {
  user: Types.ObjectId
  originalName: string
  fileName: string
  mimeType: string
  size: number
  path: string

  status: KnowledgeStatus

  chunks: number
  characters: number

  errorMessage?: string

  createdAt: Date
  updatedAt: Date
}

const knowledgeSchema = new Schema<IKnowledge>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    originalName: {
      type: String,
      required: true,
      trim: true,
    },

    fileName: {
      type: String,
      required: true,
    },

    mimeType: {
      type: String,
      required: true,
    },

    size: {
      type: Number,
      required: true,
      min: 0,
    },

    path: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: [
        "uploaded",
        "processing",
        "ready",
        "failed",
      ],
      default: "uploaded",
      index: true,
    },

    chunks: {
      type: Number,
      default: 0,
      min: 0,
    },

    characters: {
      type: Number,
      default: 0,
      min: 0,
    },

    errorMessage: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
)

// Useful for Knowledge Hub queries
knowledgeSchema.index({
  user: 1,
  createdAt: -1,
})

const Knowledge: Model<IKnowledge> =
  mongoose.models.Knowledge ||
  mongoose.model<IKnowledge>(
    "Knowledge",
    knowledgeSchema
  )

export default Knowledge
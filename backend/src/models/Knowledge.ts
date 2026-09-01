import mongoose, {
  Document,
  Model,
  Schema,
  Types,
} from "mongoose"

export type KnowledgeStatus =
  | "uploaded"
  | "processing"
  | "parsing"
  | "chunking"
  | "vector_indexing"
  | "graph_indexing"
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
  currentStep?: string
  errorMessage?: string
  retryCount?: number
  lastAttemptAt?: Date

  chunks: number
  characters: number

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
        "parsing",
        "chunking",
        "vector_indexing",
        "graph_indexing",
        "ready",
        "failed",
      ],
      default: "uploaded",
      index: true,
    },

    currentStep: {
      type: String,
      default: "uploaded",
    },

    errorMessage: {
      type: String,
      default: "",
    },

    retryCount: {
      type: Number,
      default: 0,
    },

    lastAttemptAt: {
      type: Date,
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
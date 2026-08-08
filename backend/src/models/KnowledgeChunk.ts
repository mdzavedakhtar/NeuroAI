import mongoose, {
  Document,
  Model,
  Schema,
  Types,
} from "mongoose"

export type EmbeddingStatus =
  | "pending"
  | "processing"
  | "ready"
  | "failed"

export interface IKnowledgeChunk extends Document {
  knowledgeId: Types.ObjectId
  userId: Types.ObjectId

  chunkIndex: number
  content: string
  characterCount: number

  sourceType: string
  originalName: string

  vectorId?: string
  embeddingStatus: EmbeddingStatus
  embeddingError?: string

  createdAt: Date
  updatedAt: Date
}

const knowledgeChunkSchema =
  new Schema<IKnowledgeChunk>(
    {
      knowledgeId: {
        type: Schema.Types.ObjectId,
        ref: "Knowledge",
        required: true,
        index: true,
      },

      userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },

      chunkIndex: {
        type: Number,
        required: true,
        min: 0,
      },

      content: {
        type: String,
        required: true,
      },

      characterCount: {
        type: Number,
        required: true,
        min: 0,
      },

      sourceType: {
        type: String,
        required: true,
        default: "pdf",
      },

      originalName: {
        type: String,
        required: true,
        trim: true,
      },

      vectorId: {
        type: String,
        default: "",
      },

      embeddingStatus: {
        type: String,
        enum: [
          "pending",
          "processing",
          "ready",
          "failed",
        ],
        default: "pending",
        index: true,
      },

      embeddingError: {
        type: String,
        default: "",
      },
    },
    {
      timestamps: true,
    }
  )

// One chunk index should exist only once
// for a particular knowledge document.
knowledgeChunkSchema.index(
  {
    knowledgeId: 1,
    chunkIndex: 1,
  },
  {
    unique: true,
  }
)

// Useful for user's embedding pipeline.
knowledgeChunkSchema.index({
  userId: 1,
  embeddingStatus: 1,
  createdAt: -1,
})

const KnowledgeChunk: Model<IKnowledgeChunk> =
  mongoose.models.KnowledgeChunk ||
  mongoose.model<IKnowledgeChunk>(
    "KnowledgeChunk",
    knowledgeChunkSchema
  )

export default KnowledgeChunk
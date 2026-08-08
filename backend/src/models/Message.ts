import mongoose, {
  Schema,
  Document,
  Types,
} from "mongoose"

export interface IMessageSource {
  sourceNumber: number
  fileName: string
  chunkIndex: number
  score: number
  pageNumber?: number
  knowledgeId?: string
}

export interface IMessage extends Document {
  conversationId: Types.ObjectId
  userId: Types.ObjectId

  role: "user" | "assistant"

  content: string

  sources: IMessageSource[]

  createdAt: Date
  updatedAt: Date
}

const messageSourceSchema = new Schema(
  {
    sourceNumber: {
      type: Number,
      required: true,
    },

    fileName: {
      type: String,
      required: true,
    },

    chunkIndex: {
      type: Number,
      required: true,
    },

    score: {
      type: Number,
      required: true,
    },

    knowledgeId: {
      type: String,
      default: "",
    },

    pageNumber: {
      type: Number,
      default: 1,
    },
  },
  {
    _id: false,
  }
)

const messageSchema =
  new Schema<IMessage>(
    {
      conversationId: {
        type: Schema.Types.ObjectId,
        ref: "Conversation",
        required: true,
        index: true,
      },

      userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },

      role: {
        type: String,
        enum: ["user", "assistant"],
        required: true,
      },

      content: {
        type: String,
        required: true,
        trim: true,
      },

      sources: {
        type: [messageSourceSchema],
        default: [],
      },
    },
    {
      timestamps: true,
    }
  )

messageSchema.index({
  conversationId: 1,
  createdAt: 1,
})

export default mongoose.model<IMessage>(
  "Message",
  messageSchema
)
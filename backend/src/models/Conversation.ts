import mongoose, {
  Schema,
  Document,
  Types,
} from "mongoose"

export interface IConversation
  extends Document {
  userId: Types.ObjectId
  knowledgeId?: Types.ObjectId
  title: string
  createdAt: Date
  updatedAt: Date
}

const conversationSchema =
  new Schema<IConversation>(
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

      title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120,
      },
    },
    {
      timestamps: true,
    }
  )

conversationSchema.index({
  userId: 1,
  updatedAt: -1,
})

export default mongoose.model<IConversation>(
  "Conversation",
  conversationSchema
)
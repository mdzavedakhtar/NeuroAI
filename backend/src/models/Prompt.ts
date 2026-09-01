import mongoose, { Schema, Document, Types } from "mongoose"

export interface IPrompt extends Document {
  name: string
  version: number
  template: string
  variables: string[]
  isActive: boolean
  description?: string
  createdAt: Date
  updatedAt: Date
}

const promptSchema = new Schema<IPrompt>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    version: {
      type: Number,
      required: true,
      min: 1,
    },
    template: {
      type: String,
      required: true,
    },
    variables: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    description: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
)

// Only one active version per prompt name
promptSchema.index({ name: 1, version: 1 }, { unique: true })
promptSchema.index({ name: 1, isActive: 1 })

export default mongoose.model<IPrompt>("Prompt", promptSchema)

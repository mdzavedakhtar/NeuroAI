import mongoose, {
  Document,
  Model,
  Schema,
} from "mongoose"
import bcrypt from "bcryptjs"

export type UserRole = "user" | "admin"

export interface IUser extends Document {
  name: string
  email: string
  password?: string
  avatar?: string

  role: UserRole

  authProvider: "local" | "google"
  googleId?: string

  isEmailVerified: boolean
  isActive: boolean

  lastLoginAt?: Date

  createdAt: Date
  updatedAt: Date

  comparePassword(
    candidatePassword: string
  ): Promise<boolean>
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: 2,
      maxlength: 60,
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    password: {
      type: String,
      minlength: 8,
      select: false,
    },

    avatar: {
      type: String,
      default: "",
    },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },

    googleId: {
      type: String,
      default: undefined,
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastLoginAt: {
      type: Date,
      default: undefined,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
)

/*
|--------------------------------------------------------------------------
| Password Hashing
|--------------------------------------------------------------------------
*/

userSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return
  }

  if (!this.password) {
    return
  }

  const salt = await bcrypt.genSalt(12)

  this.password = await bcrypt.hash(
    this.password,
    salt
  )
})

/*
|--------------------------------------------------------------------------
| Password Comparison
|--------------------------------------------------------------------------
*/

userSchema.methods.comparePassword =
  async function (
    candidatePassword: string
  ): Promise<boolean> {
    if (!this.password) {
      return false
    }

    return bcrypt.compare(
      candidatePassword,
      this.password
    )
  }

/*
|--------------------------------------------------------------------------
| Model
|--------------------------------------------------------------------------
*/

const User: Model<IUser> =
  mongoose.models.User ||
  mongoose.model<IUser>("User", userSchema)

export default User
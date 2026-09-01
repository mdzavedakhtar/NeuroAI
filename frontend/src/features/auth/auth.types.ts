export type User = {
  _id: string
  id?: string
  name?: string
  email: string
  role?: string
  avatar?: string
  isEmailVerified?: boolean
}

export type LoginPayload = {
  email: string
  password: string
}

export type RegisterPayload = {
  name: string
  email: string
  password: string
}

export type AuthResponse = {
  success?: boolean
  token?: string
  user?: User
  message?: string
  verificationEmailSent?: boolean
  devVerificationUrl?: string
}

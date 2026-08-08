const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:5000/api"

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

export function getToken() {
  if (typeof window === "undefined") {
    return null
  }

  return localStorage.getItem("neurostack_token")
}

export function setToken(token: string) {
  if (typeof window === "undefined") {
    return
  }

  localStorage.setItem("neurostack_token", token)
}

export function removeToken() {
  if (typeof window === "undefined") {
    return
  }

  localStorage.removeItem("neurostack_token")
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()

  const headers = new Headers(options.headers)

  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json")
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  const response = await fetch(
    `${API_URL}${endpoint}`,
    {
      ...options,
      headers,
    }
  )

  const contentType =
    response.headers.get("content-type")

  let data: unknown = null

  if (contentType?.includes("application/json")) {
    data = await response.json()
  } else {
    data = await response.text()
  }

  if (!response.ok) {
    let message = "Request failed"

    if (
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof data.message === "string"
    ) {
      message = data.message
    }

    if (response.status === 401) {
      removeToken()
    }

    throw new ApiError(
      message,
      response.status
    )
  }

  return data as T
}

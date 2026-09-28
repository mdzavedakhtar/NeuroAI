export interface IPlan {
  name: string
  requestsLimit: number
  aiGenerationsLimit: number
  tokensLimit: number
  documentsLimit: number
  storageLimit: number // in bytes
}

export const PLANS: Record<string, IPlan> = {
  free: {
    name: "Free",
    requestsLimit: 2000,
    aiGenerationsLimit: 500,
    tokensLimit: 1000000,
    documentsLimit: 25,
    storageLimit: 100 * 1024 * 1024, // 100 MB
  },
  developer: {
    name: "Developer",
    requestsLimit: 10000,
    aiGenerationsLimit: 1000,
    tokensLimit: 2000000,
    documentsLimit: 50,
    storageLimit: 250 * 1024 * 1024, // 250 MB
  },
}

export function getPlanLimits(planName?: string): IPlan {
  return PLANS[planName || "free"] || PLANS.free;
}

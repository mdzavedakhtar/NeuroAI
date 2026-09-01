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
    requestsLimit: 100, // 100 requests per usage period for testing limit triggers easily
    aiGenerationsLimit: 10,
    tokensLimit: 20000,
    documentsLimit: 3,
    storageLimit: 5 * 1024 * 1024, // 5 MB
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

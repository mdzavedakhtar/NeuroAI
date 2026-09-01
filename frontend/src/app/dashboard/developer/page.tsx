"use client"

import { useEffect, useState } from "react"
import { KeyRound, Loader2, Plus, RefreshCw, Trash2, Eye, EyeOff, Copy, Check, FileText, BarChart3, HelpCircle } from "lucide-react"
import { toast } from "sonner"
import { AppHeader } from "@/components/dashboard/app-header"
import { apiFetch } from "@/services/api"

type ApiKeyRecord = {
  _id: string
  name: string
  keyMasked: string
  isActive: boolean
  permissions: string[]
  lastUsedAt?: string
  createdAt: string
}

type UsageOverview = {
  planName: string
  limits: {
    requestsLimit: number
    aiGenerationsLimit: number
    tokensLimit: number
    documentsLimit: number
    storageLimit: number
  }
  usage: {
    requestsCount: number
    aiGenerationsCount: number
    tokensCount: number
    documentsCount: number
    storageBytes: number
  }
}

export default function DeveloperPage() {
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([])
  const [usage, setUsage] = useState<UsageOverview | null>(null)
  const [loadingKeys, setLoadingKeys] = useState(true)
  const [loadingUsage, setLoadingUsage] = useState(true)
  const [creatingKey, setCreatingKey] = useState(false)
  const [newKeyName, setNewKeyName] = useState("")
  const [showKeyModal, setShowKeyModal] = useState(false)
  const [newlyCreatedRawKey, setNewlyCreatedRawKey] = useState("")
  const [copied, setCopied] = useState(false)

  // Actions loading states
  const [processingId, setProcessingId] = useState<string | null>(null)

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    await Promise.all([loadApiKeys(), loadUsageOverview()])
  }

  async function loadApiKeys() {
    try {
      setLoadingKeys(true)
      const res = await apiFetch<{ success: boolean; apiKeys: ApiKeyRecord[] }>("/apikeys")
      if (res.success) {
        setApiKeys(res.apiKeys)
      }
    } catch (err) {
      toast.error("Failed to load API keys")
    } finally {
      setLoadingKeys(false)
    }
  }

  async function loadUsageOverview() {
    try {
      setLoadingUsage(true)
      const res = await apiFetch<{ success: boolean; overview: UsageOverview }>("/apikeys/usage/overview")
      if (res.success) {
        setUsage(res.overview)
      }
    } catch (err) {
      toast.error("Failed to load usage statistics")
    } finally {
      setLoadingUsage(false)
    }
  }

  async function handleCreateKey(e: React.FormEvent) {
    e.preventDefault()
    if (!newKeyName.trim()) {
      toast.error("Key name is required")
      return
    }

    try {
      setCreatingKey(true)
      const res = await apiFetch<{ success: boolean; apiKey: ApiKeyRecord; rawKey: string }>("/apikeys", {
        method: "POST",
        body: JSON.stringify({ name: newKeyName.trim() }),
      })

      if (res.success) {
        setNewlyCreatedRawKey(res.rawKey)
        setShowKeyModal(true)
        setNewKeyName("")
        void loadApiKeys()
        toast.success("API key generated successfully")
      }
    } catch (err) {
      toast.error("Failed to generate API key")
    } finally {
      setCreatingKey(false)
    }
  }

  async function handleRevokeKey(id: string) {
    if (!confirm("Are you sure you want to revoke this API key? This action is permanent and cannot be undone.")) {
      return
    }

    try {
      setProcessingId(id)
      const res = await apiFetch<{ success: boolean }>("/apikeys/" + id, {
        method: "DELETE",
      })
      if (res.success) {
        setApiKeys((prev) => prev.filter((k) => k._id !== id))
        toast.success("API key revoked")
      }
    } catch (err) {
      toast.error("Failed to revoke API key")
    } finally {
      setProcessingId(null)
    }
  }

  async function handleRotateKey(id: string) {
    if (!confirm("Are you sure you want to rotate this key? The existing key credentials will be invalidated immediately.")) {
      return
    }

    try {
      setProcessingId(id)
      const res = await apiFetch<{ success: boolean; apiKey: ApiKeyRecord; rawKey: string }>("/apikeys/" + id + "/rotate", {
        method: "POST",
      })
      if (res.success) {
        setNewlyCreatedRawKey(res.rawKey)
        setShowKeyModal(true)
        void loadApiKeys()
        toast.success("API key rotated successfully")
      }
    } catch (err) {
      toast.error("Failed to rotate API key")
    } finally {
      setProcessingId(null)
    }
  }

  async function handleCopyKey() {
    try {
      await navigator.clipboard.writeText(newlyCreatedRawKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      toast.error("Failed to copy key")
    }
  }

  function formatStorage(bytes: number): string {
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(1)} MB`
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#212121] text-[#ececec]">
      <AppHeader
        title="Developer Platform"
        description="Manage API credentials, configure limits, and monitor usage metrics"
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">

          {/* Usage Stats Overview */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Requests Stat Card */}
            <div className="rounded-2xl bg-[#2f2f2f] border border-white/10 p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-medium text-[#8e8e8e]">API Requests</span>
                <span className="text-[10px] uppercase font-semibold text-white/50 bg-white/5 px-2 py-0.5 rounded">
                  {usage?.planName || "Free"}
                </span>
              </div>
              {loadingUsage ? (
                <div className="h-10 flex items-center"><Loader2 className="size-4 animate-spin text-[#8e8e8e]" /></div>
              ) : (
                <>
                  <div className="text-2xl font-bold mt-1">
                    {usage?.usage.requestsCount} <span className="text-xs text-[#8e8e8e] font-normal">/ {usage?.limits.requestsLimit}</span>
                  </div>
                  <div className="w-full bg-white/10 h-1.5 rounded-full mt-3 overflow-hidden">
                    <div
                      className="bg-[#19c37d] h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          ((usage?.usage.requestsCount || 0) / (usage?.limits.requestsLimit || 1)) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </>
              )}
            </div>

            {/* AI Generations Card */}
            <div className="rounded-2xl bg-[#2f2f2f] border border-white/10 p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-medium text-[#8e8e8e]">AI Generations</span>
                <span className="text-[10px] uppercase font-semibold text-white/50 bg-white/5 px-2 py-0.5 rounded">
                  Monthly
                </span>
              </div>
              {loadingUsage ? (
                <div className="h-10 flex items-center"><Loader2 className="size-4 animate-spin text-[#8e8e8e]" /></div>
              ) : (
                <>
                  <div className="text-2xl font-bold mt-1">
                    {usage?.usage.aiGenerationsCount} <span className="text-xs text-[#8e8e8e] font-normal">/ {usage?.limits.aiGenerationsLimit}</span>
                  </div>
                  <div className="w-full bg-white/10 h-1.5 rounded-full mt-3 overflow-hidden">
                    <div
                      className="bg-indigo-400 h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          ((usage?.usage.aiGenerationsCount || 0) / (usage?.limits.aiGenerationsLimit || 1)) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Storage Usage Card */}
            <div className="rounded-2xl bg-[#2f2f2f] border border-white/10 p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-medium text-[#8e8e8e]">Storage Capacity</span>
                <span className="text-[10px] uppercase font-semibold text-white/50 bg-white/5 px-2 py-0.5 rounded">
                  Documents
                </span>
              </div>
              {loadingUsage ? (
                <div className="h-10 flex items-center"><Loader2 className="size-4 animate-spin text-[#8e8e8e]" /></div>
              ) : (
                <>
                  <div className="text-2xl font-bold mt-1">
                    {formatStorage(usage?.usage.storageBytes || 0)} <span className="text-xs text-[#8e8e8e] font-normal">/ {formatStorage(usage?.limits.storageLimit || 0)}</span>
                  </div>
                  <div className="text-[10.5px] text-[#8e8e8e] mt-1">
                    Used {usage?.usage.documentsCount} of {usage?.limits.documentsLimit} allowed documents
                  </div>
                  <div className="w-full bg-white/10 h-1.5 rounded-full mt-2.5 overflow-hidden">
                    <div
                      className="bg-sky-400 h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          ((usage?.usage.storageBytes || 0) / (usage?.limits.storageLimit || 1)) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Quick links & swagger documentation info */}
          <section className="rounded-2xl bg-[#2f2f2f] border border-white/10 p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-white/10 text-emerald-400">
                <FileText className="size-4" />
              </div>
              <div>
                <h3 className="text-[13.5px] font-semibold text-[#ececec]">Interactive Swagger API Docs</h3>
                <p className="text-[11px] text-[#8e8e8e]">Explore requests format, error payloads, and try out live endpoints</p>
              </div>
            </div>
            <a
              href="http://localhost:5000/api-docs"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/15 px-4.5 py-2 text-[12.5px] font-semibold text-[#ececec] transition-all cursor-pointer"
            >
              Open API Docs
            </a>
          </section>

          {/* Key Generation Section */}
          <section className="rounded-2xl bg-[#2f2f2f] border border-white/10 overflow-hidden">
            <div className="border-b border-white/[0.08] px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-white/10 text-[#19c37d]">
                  <KeyRound className="size-4" />
                </div>
                <div>
                  <h2 className="text-[14px] font-semibold text-[#ececec]">Developer API Keys</h2>
                  <p className="text-[11px] text-[#8e8e8e]">Authenticate your custom applications with API keys</p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* Create API Key Form */}
              <form onSubmit={handleCreateKey} className="flex gap-3 max-w-lg">
                <input
                  type="text"
                  placeholder="Key name (e.g. Production server)"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  disabled={creatingKey}
                  className="flex-1 rounded-xl bg-[#212121] border border-white/10 px-3 py-2 text-[13.5px] text-[#ececec] placeholder-[#8e8e8e] outline-none focus:border-white/30 transition-colors"
                />
                <button
                  type="submit"
                  disabled={creatingKey}
                  className="flex items-center gap-1.5 rounded-xl bg-white text-black px-4.5 py-2 text-[12.5px] font-semibold hover:bg-white/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
                >
                  {creatingKey ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  Create key
                </button>
              </form>

              {/* Keys list */}
              <div className="border border-white/10 rounded-xl overflow-hidden bg-[#212121]">
                {loadingKeys ? (
                  <div className="p-8 flex items-center justify-center">
                    <Loader2 className="size-5 animate-spin text-[#8e8e8e]" />
                  </div>
                ) : apiKeys.length === 0 ? (
                  <div className="p-8 text-center text-[13px] text-[#8e8e8e]">
                    No API keys generated yet. Create one above to get started.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[12.5px] border-collapse">
                      <thead>
                        <tr className="border-b border-white/[0.08] text-[#8e8e8e] font-medium bg-[#292929]">
                          <th className="px-4 py-3">Name</th>
                          <th className="px-4 py-3">API Key</th>
                          <th className="px-4 py-3">Permissions</th>
                          <th className="px-4 py-3">Last Used</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.08]">
                        {apiKeys.map((key) => (
                          <tr key={key._id} className="hover:bg-white/[0.02]">
                            <td className="px-4 py-3 font-medium text-[#ececec]">{key.name}</td>
                            <td className="px-4 py-3 font-mono text-[11px] text-white/70">{key.keyMasked}</td>
                            <td className="px-4 py-3 text-[#8e8e8e]">
                              {key.permissions.map((p) => (
                                <span key={p} className="bg-white/5 border border-white/10 text-[10px] px-1.5 py-0.5 rounded mr-1">
                                  {p}
                                </span>
                              ))}
                            </td>
                            <td className="px-4 py-3 text-[#8e8e8e]">
                              {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : "Never"}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="inline-flex gap-2">
                                <button
                                  onClick={() => handleRotateKey(key._id)}
                                  disabled={processingId !== null}
                                  className="p-1.5 rounded-lg text-[#8e8e8e] hover:text-indigo-400 hover:bg-white/5 transition-colors cursor-pointer"
                                  title="Rotate API Key"
                                >
                                  <RefreshCw className={`size-3.5 ${processingId === key._id ? "animate-spin" : ""}`} />
                                </button>
                                <button
                                  onClick={() => handleRevokeKey(key._id)}
                                  disabled={processingId !== null}
                                  className="p-1.5 rounded-lg text-[#8e8e8e] hover:text-red-400 hover:bg-white/5 transition-colors cursor-pointer"
                                  title="Revoke API Key"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </section>

        </div>
      </div>

      {/* Raw key popup modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#2f2f2f] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-semibold text-[#ececec] mb-2 flex items-center gap-2">
              🔑 Save your API Key
            </h3>
            <p className="text-[12px] text-[#8e8e8e] mb-4 leading-normal">
              Copy this API Key and save it securely. For security reasons, **you cannot view this key again** once you close this dialog.
            </p>

            <div className="flex items-center gap-2 bg-[#212121] border border-white/10 rounded-xl px-3 py-3 mb-5 font-mono text-[13px] text-[#ececec]">
              <span className="flex-1 select-all break-all">{newlyCreatedRawKey}</span>
              <button
                onClick={handleCopyKey}
                className="p-2 rounded-lg hover:bg-white/5 text-[#8e8e8e] hover:text-[#ececec] transition-colors cursor-pointer shrink-0"
                title="Copy to clipboard"
              >
                {copied ? (
                  <Check className="size-4 text-[#19c37d]" />
                ) : (
                  <Copy className="size-4" />
                )}
              </button>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => {
                  setShowKeyModal(false)
                  setNewlyCreatedRawKey("")
                }}
                className="rounded-xl bg-white text-black px-5 py-2 text-[12.5px] font-semibold hover:bg-white/90 transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

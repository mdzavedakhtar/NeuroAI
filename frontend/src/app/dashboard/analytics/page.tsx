"use client"

import { useEffect, useState } from "react"
import { Loader2, Users, FileText, Search, Sparkles, TrendingUp, ThumbsUp, Activity, Cpu } from "lucide-react"
import { toast } from "sonner"
import { AppHeader } from "@/components/dashboard/app-header"
import { apiFetch } from "@/services/api"

type AnalyticsData = {
  totalUsers: number
  totalDocuments: number
  totalQueries: number
  activeUsers: number
  documentStatus: {
    uploaded: number
    processing: number
    ready: number
    failed: number
  }
  totalTokens: number
  feedbackStats: {
    helpful: number
    not_helpful: number
  }
  latencyStats: {
    averageResponseTimeMs: number
    p95LatencyMs: number
    neo4jLatencyMs: number
    pineconeLatencyMs: number
  }
  modelUsage: { name: string; count: number }[]
  mostSearchedTopics: { name: string; count: number }[]
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void loadAnalytics()
  }, [])

  async function loadAnalytics() {
    try {
      setLoading(true)
      const res = await apiFetch<{ success: boolean; stats: AnalyticsData }>("/analytics/stats")
      if (res.success) {
        setData(res.stats)
      }
    } catch (err) {
      toast.error("Failed to load system analytics telemetry")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#212121] text-[#ececec]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-[#19c37d]" />
          <p className="text-sm text-[#8e8e8e]">Compiling system telemetry…</p>
        </div>
      </div>
    )
  }

  const successRate = data
    ? (data.documentStatus?.ready ?? 0) + (data.documentStatus?.failed ?? 0) > 0
      ? Math.round(((data.documentStatus?.ready ?? 0) / ((data.documentStatus?.ready ?? 0) + (data.documentStatus?.failed ?? 0))) * 100)
      : 100
    : 100

  const helpfulRatio = data
    ? (data.feedbackStats?.helpful ?? 0) + (data.feedbackStats?.not_helpful ?? 0) > 0
      ? Math.round(((data.feedbackStats?.helpful ?? 0) / ((data.feedbackStats?.helpful ?? 0) + (data.feedbackStats?.not_helpful ?? 0))) * 100)
      : 100
    : 100

  return (
    <div className="flex flex-col h-full w-full bg-[#212121] text-[#ececec]">
      <AppHeader
        title="Analytics Console"
        description="Monitor system usage, parsing reliability, and retrieval speeds in real-time"
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">

          {/* Key Indicators Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={<Users className="size-4 text-[#19c37d]" />}
              label="Total Users"
              value={data?.totalUsers ?? 0}
              subtext={`${data?.activeUsers ?? 0} active (30d)`}
            />
            <StatCard
              icon={<FileText className="size-4 text-sky-400" />}
              label="Knowledge Sources"
              value={data?.totalDocuments ?? 0}
              subtext="PDFs, DOCX, XLSX, PPTX"
            />
            <StatCard
              icon={<Search className="size-4 text-purple-400" />}
              label="Total Queries"
              value={data?.totalQueries ?? 0}
              subtext="RAG & Direct prompts"
            />
            <StatCard
              icon={<Cpu className="size-4 text-pink-400" />}
              label="Total Tokens"
              value={data?.totalTokens ? (data.totalTokens / 1000).toFixed(1) + "k" : "0"}
              subtext="Estimated processing"
            />
          </div>

          {/* Ingestion & Latency Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Document Ingestion Status */}
            <div className="rounded-2xl bg-[#2f2f2f] border border-white/10 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-semibold uppercase tracking-wider text-[#8e8e8e]">Ingestion Success Rate</h3>
                <span className="text-[12px] font-semibold text-[#19c37d]">{successRate}% Success</span>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="space-y-1">
                  <span className="text-[11px] text-[#8e8e8e]">Ready Documents</span>
                  <div className="text-xl font-bold text-[#ececec]">{data?.documentStatus.ready}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-[#8e8e8e]">Failed Documents</span>
                  <div className="text-xl font-bold text-red-400">{data?.documentStatus.failed}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-[#8e8e8e]">Processing</span>
                  <div className="text-xl font-bold text-amber-400">{data?.documentStatus.processing}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-[#8e8e8e]">Uploaded</span>
                  <div className="text-xl font-bold text-white/50">{data?.documentStatus.uploaded}</div>
                </div>
              </div>

              <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden flex">
                <div className="bg-[#19c37d] h-full" style={{ width: `${successRate}%` }} />
                <div className="bg-red-400 h-full" style={{ width: `${100 - successRate}%` }} />
              </div>
            </div>

            {/* Performance Telemetry */}
            <div className="rounded-2xl bg-[#2f2f2f] border border-white/10 p-5 space-y-4">
              <h3 className="text-[13px] font-semibold uppercase tracking-wider text-[#8e8e8e] flex items-center gap-1.5">
                <Activity className="size-3.5 text-[#19c37d]" /> Latency Telemetry
              </h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-[#8e8e8e]">Average LLM RAG Response</span>
                  <span className="font-semibold">{data?.latencyStats?.averageResponseTimeMs ?? '—'} ms</span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-[#8e8e8e]">95th Percentile Response</span>
                  <span className="font-semibold">{data?.latencyStats?.p95LatencyMs ?? '—'} ms</span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-[#8e8e8e]">Neo4j Graph Matching</span>
                  <span className="font-semibold text-purple-400">{data?.latencyStats?.neo4jLatencyMs ?? '—'} ms</span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-[#8e8e8e]">Pinecone Vector Lookup</span>
                  <span className="font-semibold text-sky-400">{data?.latencyStats?.pineconeLatencyMs ?? '—'} ms</span>
                </div>
              </div>
            </div>
          </div>

          {/* Model Usage & Popular Search Topics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Model & Feedback Ratio */}
            <div className="rounded-2xl bg-[#2f2f2f] border border-white/10 p-5 space-y-5">
              <div>
                <h3 className="text-[13px] font-semibold uppercase tracking-wider text-[#8e8e8e] mb-3">Model Usage Distribution</h3>
                <div className="space-y-2">
                  {data?.modelUsage.map((m) => (
                    <div key={m.name} className="flex items-center justify-between text-[12.5px]">
                      <span className="text-white/80">{m.name}</span>
                      <span className="font-mono bg-white/5 border border-white/10 rounded px-2 py-0.5">{m.count} hits</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-white/[0.08] pt-4">
                <div className="flex items-center justify-between text-[12.5px] mb-2">
                  <span className="text-[#8e8e8e] flex items-center gap-1.5"><ThumbsUp className="size-3.5 text-[#19c37d]" /> Helpful Response Ratio</span>
                  <span className="font-semibold text-[#19c37d]">{helpfulRatio}%</span>
                </div>
                <div className="text-[10px] text-[#8e8e8e]">
                  Based on {data?.feedbackStats?.helpful || 0} helpful vs {data?.feedbackStats?.not_helpful || 0} not helpful entries
                </div>
              </div>
            </div>

            {/* Popular Topics */}
            <div className="rounded-2xl bg-[#2f2f2f] border border-white/10 p-5 space-y-4">
              <h3 className="text-[13px] font-semibold uppercase tracking-wider text-[#8e8e8e] flex items-center gap-1.5">
                <TrendingUp className="size-3.5 text-[#19c37d]" /> Trending Concepts
              </h3>
              <p className="text-[11px] text-[#8e8e8e]">Popular keywords queried by users from knowledge files</p>

              <div className="flex flex-wrap gap-2 pt-2">
                {(data?.mostSearchedTopics ?? []).map((topic, idx) => (
                  <div
                    key={topic.name}
                    className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3.5 py-1.5 text-xs hover:border-white/20 transition-all cursor-default"
                  >
                    <span className="font-semibold text-[#19c37d]">#{idx + 1}</span>
                    <span className="font-medium text-[#ececec]">{topic.name}</span>
                    <span className="bg-white/10 rounded-full size-4 flex items-center justify-center text-[9px] text-white/70">
                      {topic.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  subtext,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  subtext: string
}) {
  return (
    <div className="rounded-2xl bg-[#2f2f2f] border border-white/10 p-5 space-y-3">
      <div className="flex items-center justify-between text-[#8e8e8e]">
        <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
        {icon}
      </div>
      <div className="space-y-0.5">
        <p className="text-2xl font-bold text-[#ececec]">{value}</p>
        <p className="text-[10px] text-[#8e8e8e] truncate">{subtext}</p>
      </div>
    </div>
  )
}

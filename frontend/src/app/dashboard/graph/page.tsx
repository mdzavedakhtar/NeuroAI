"use client"

import { useEffect, useState } from "react"
import {
  ArrowRight,
  Database,
  FileText,
  Loader2,
  Network,
  Search,
  Sparkles,
  Tags,
} from "lucide-react"
import { toast } from "sonner"
import { AppHeader } from "@/components/dashboard/app-header"
import { getGraphStats, lookupEntity, queryGraph } from "@/features/graph/graph.service"
import type { GraphQueryResult, GraphRelationship, GraphSourceRef, GraphStats } from "@/features/graph/graph.types"
import { cn } from "@/lib/utils"

const EMPTY_STATS: GraphStats = {
  documents: 0,
  chunks: 0,
  entities: 0,
}

export default function GraphExplorerPage() {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<GraphQueryResult | null>(null)
  const [stats, setStats] = useState<GraphStats>(EMPTY_STATS)

  useEffect(() => {
    let cancelled = false

    getGraphStats()
      .then((response) => {
        if (!cancelled && response.stats) {
          setStats(response.stats)
        }
      })
      .catch(() => {
        // Graph may be offline — stats stay zero, UI shows a hint.
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function runQuery(mode: "query" | "entity") {
    const value = query.trim()
    if (!value || loading) return

    setLoading(true)
    setResult(null)

    try {
      const response =
        mode === "entity"
          ? await lookupEntity(value)
          : await queryGraph(value)

      if (!response.success) {
        throw new Error(response.message || "Graph query failed")
      }

      setResult({
        query: response.query,
        entities: response.entities ?? [],
        relationships: response.relationships ?? [],
        sources: response.sources ?? [],
        summary: response.summary,
      })

      getGraphStats()
        .then((s) => {
          if (s.stats) setStats(s.stats)
        })
        .catch(() => {
          // ignore
        })
    } catch (error) {
      console.error(error)
      toast.error(
        error instanceof Error
          ? error.message
          : "Graph query failed. Make sure Neo4j is connected."
      )
    } finally {
      setLoading(false)
    }
  }

  const entityNameById = new Map<string, string>()
  result?.entities.forEach((e) => {
    entityNameById.set(e.id, e.name)
  })

  function resolveName(id: string) {
    return entityNameById.get(id) ?? id
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#212121] text-[#ececec]">
      <AppHeader
        title="Graph Explorer"
        description="Explore entities and relationships in your knowledge graph"
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              icon={<Database className="size-4 text-[#19c37d]" />}
              label="Documents"
              value={stats.documents}
            />
            <StatCard
              icon={<FileText className="size-4 text-[#4da3ff]" />}
              label="Chunks"
              value={stats.chunks}
            />
            <StatCard
              icon={<Network className="size-4 text-[#c084fc]" />}
              label="Entities"
              value={stats.entities}
            />
          </div>

          {/* Query input */}
          <div className="rounded-2xl bg-[#2f2f2f] border border-white/10 p-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 flex items-center gap-2 bg-[#212121] border border-white/10 rounded-xl px-3">
                <Search className="size-4 text-[#8e8e8e] shrink-0" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void runQuery("query")
                  }}
                  placeholder="Ask about your knowledge graph… e.g. “What entities are related to Gemini?”"
                  className="w-full bg-transparent border-0 outline-none py-3 text-[14px] text-[#ececec] placeholder-[#8e8e8e]"
                />
              </div>

              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => void runQuery("entity")}
                  disabled={loading || !query.trim()}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl border border-white/10 text-[13px] font-medium text-[#8e8e8e] hover:text-[#ececec] hover:border-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  title="Look up an exact entity name"
                >
                  <Tags className="size-4" />
                  <span className="hidden sm:inline">Entity</span>
                </button>

                <button
                  onClick={() => void runQuery("query")}
                  disabled={loading || !query.trim()}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white text-black text-[13px] font-semibold hover:bg-white/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  <span>Explore</span>
                </button>
              </div>
            </div>

            {stats.entities === 0 && !result && (
              <p className="mt-2.5 px-1 text-[11px] text-[#8e8e8e]">
                Upload a document in Chat to extract entities into the graph automatically.
              </p>
            )}
          </div>

          {/* Results */}
          {result && (
            <div className="space-y-5">
              {/* Summary */}
              {result.summary && (
                <div className="rounded-2xl bg-[#2f2f2f] border border-white/10 p-5">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#8e8e8e]">
                    Summary
                  </p>
                  <p className="text-[14px] leading-6 text-[#ececec] whitespace-pre-wrap">
                    {result.summary}
                  </p>
                </div>
              )}

              {/* Entities */}
              <section>
                <SectionTitle
                  title="Entities"
                  count={result.entities.length}
                />
                {result.entities.length === 0 ? (
                  <EmptyState text="No entities found for this query." />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {result.entities.map((entity) => (
                      <div
                        key={entity.id}
                        className="rounded-xl bg-[#2f2f2f] border border-white/10 p-4 hover:border-white/20 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-[14px] text-[#ececec] truncate">
                            {entity.name}
                          </p>
                          <span className="shrink-0 rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-medium text-[#c084fc]">
                            {entity.labels[0] ?? "Entity"}
                          </span>
                        </div>
                        {entity.description && (
                          <p className="mt-1.5 text-[12.5px] leading-5 text-[#8e8e8e] line-clamp-3">
                            {entity.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Relationships */}
              <section>
                <SectionTitle
                  title="Relationships"
                  count={result.relationships.length}
                />
                {result.relationships.length === 0 ? (
                  <EmptyState text="No relationships found for this query." />
                ) : (
                  <div className="rounded-xl bg-[#2f2f2f] border border-white/10 overflow-hidden">
                    <ul className="divide-y divide-white/[0.06]">
                      {result.relationships.map((rel, index) => (
                        <RelationshipRow
                          key={index}
                          rel={rel}
                          resolveName={resolveName}
                        />
                      ))}
                    </ul>
                  </div>
                )}
              </section>

              {/* Sources */}
              <section>
                <SectionTitle
                  title="Sources"
                  count={result.sources.length}
                />
                {result.sources.length === 0 ? (
                  <EmptyState text="No source chunks found for this query." />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {result.sources.map((source, index) => (
                      <SourceRow key={index} source={source} />
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* Initial hint */}
          {!result && stats.entities > 0 && (
            <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center">
              <Network className="mx-auto size-8 text-[#8e8e8e]" />
              <p className="mt-3 text-[14px] font-medium text-[#ececec]">
                Your knowledge graph is ready
              </p>
              <p className="mt-1 text-[12.5px] text-[#8e8e8e]">
                Ask a question above to see entities and how they connect.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   SMALL PIECES
   ============================================================ */

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: number
}) {
  return (
    <div className="rounded-xl bg-[#2f2f2f] border border-white/10 p-4">
      <div className="flex items-center gap-2 text-[#8e8e8e]">
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="mt-2 text-[22px] font-semibold text-[#ececec]">
        {value}
      </p>
    </div>
  )
}

function SectionTitle({
  title,
  count,
}: {
  title: string
  count: number
}) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <h2 className="text-[13px] font-semibold text-[#ececec] uppercase tracking-wider">
        {title}
      </h2>
      <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] text-[#8e8e8e]">
        {count}
      </span>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/15 px-4 py-6 text-center text-[12.5px] text-[#8e8e8e]">
      {text}
    </div>
  )
}

function RelationshipRow({
  rel,
  resolveName,
}: {
  rel: GraphRelationship
  resolveName: (id: string) => string
}) {
  return (
    <li className="flex items-center gap-2.5 px-4 py-3">
      <span className="font-medium text-[13px] text-[#ececec] truncate">
        {resolveName(rel.source)}
      </span>
      <span className="shrink-0 flex items-center gap-1.5">
        <ArrowRight className="size-3 text-[#8e8e8e]" />
        <span className="rounded-md bg-[#c084fc]/10 border border-[#c084fc]/20 px-2 py-0.5 text-[10.5px] font-medium text-[#c084fc]">
          {rel.relationshipType}
        </span>
        <ArrowRight className="size-3 text-[#8e8e8e]" />
      </span>
      <span className="font-medium text-[13px] text-[#ececec] truncate">
        {resolveName(rel.target)}
      </span>
    </li>
  )
}

function SourceRow({
  source,
}: {
  source: GraphSourceRef
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl bg-[#2f2f2f] border border-white/10 px-3.5 py-3"
      )}
    >
      <FileText className="size-4 text-[#19c37d] shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-[#ececec]">
          {source.fileName || "Source document"}
        </p>
        <p className="mt-0.5 text-[11px] text-[#8e8e8e]">
          Chunk {source.chunkIndex + 1}
          {source.pageNumber > 0 ? ` · Page ${source.pageNumber}` : ""}
        </p>
      </div>
    </div>
  )
}

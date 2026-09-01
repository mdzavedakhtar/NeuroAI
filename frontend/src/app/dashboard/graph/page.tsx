"use client"

import { useEffect, useState, useRef } from "react"
import {
  ArrowRight,
  Database,
  FileText,
  Loader2,
  Network,
  Search,
  Sparkles,
  Tags,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Layers,
  ChevronRight,
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

type Node = {
  id: string
  name: string
  label: string
  x: number
  y: number
  description?: string
}

type Link = {
  source: string
  target: string
  type: string
}

export default function GraphExplorerPage() {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<GraphQueryResult | null>(null)
  const [stats, setStats] = useState<GraphStats>(EMPTY_STATS)

  // Interactive Graph Visualizer State
  const [nodes, setNodes] = useState<Node[]>([])
  const [links, setLinks] = useState<Link[]>([])
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null)
  const [filterLabel, setFilterLabel] = useState<string | null>(null)

  // Zoom / Pan State
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const isDraggingCanvas = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const svgRef = useRef<SVGSVGElement | null>(null)

  // Node Drag State
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getGraphStats()
      .then((response) => {
        if (!cancelled && response.stats) {
          setStats(response.stats)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // Initialize graph layout when result changes
  useEffect(() => {
    if (!result) {
      setNodes([])
      setLinks([])
      setSelectedNode(null)
      return
    }

    // Map result entities to nodes
    const initialNodes: Node[] = result.entities.map((e, idx, arr) => {
      // Concentric circle layout spacing
      const angle = (idx / arr.length) * 2 * Math.PI
      const radius = 160 + Math.random() * 40 // space out nodes
      return {
        id: e.id,
        name: e.name,
        label: e.labels[0] ?? "Entity",
        description: e.description,
        x: 350 + radius * Math.cos(angle),
        y: 220 + radius * Math.sin(angle),
      }
    })

    const initialLinks: Link[] = result.relationships.map((r) => ({
      source: r.source,
      target: r.target,
      type: r.relationshipType,
    }))

    // Simple spring layout simulation ticks to settle the layout
    const width = 700
    const height = 440
    let tempNodes = [...initialNodes]

    for (let step = 0; step < 50; step++) {
      // Repulsion force between all node pairs
      for (let i = 0; i < tempNodes.length; i++) {
        for (let j = i + 1; j < tempNodes.length; j++) {
          const dx = tempNodes[j].x - tempNodes[i].x
          const dy = tempNodes[j].y - tempNodes[i].y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          if (dist < 180) {
            const force = (180 - dist) / 10
            const fx = (dx / dist) * force
            const fy = (dy / dist) * force
            tempNodes[i].x -= fx
            tempNodes[i].y -= fy
            tempNodes[j].x += fx
            tempNodes[j].y += fy
          }
        }
      }

      // Attraction force along links
      initialLinks.forEach((link) => {
        const sourceNode = tempNodes.find((n) => n.id === link.source)
        const targetNode = tempNodes.find((n) => n.id === link.target)
        if (sourceNode && targetNode) {
          const dx = targetNode.x - sourceNode.x
          const dy = targetNode.y - sourceNode.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          if (dist > 120) {
            const force = (dist - 120) / 15
            const fx = (dx / dist) * force
            const fy = (dy / dist) * force
            sourceNode.x += fx
            sourceNode.y += fy
            targetNode.x -= fx
            targetNode.y -= fy
          }
        }
      })

      // Keep inside bounds
      tempNodes.forEach((node) => {
        node.x = Math.max(50, Math.min(width - 50, node.x))
        node.y = Math.max(50, Math.min(height - 50, node.y))
      })
    }

    setNodes(tempNodes)
    setLinks(initialLinks)
    setTransform({ x: 0, y: 0, scale: 1 }) // reset zoom
  }, [result])

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
        .catch(() => {})
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

  // Zoom Helpers
  function zoomIn() {
    setTransform((t) => ({ ...t, scale: Math.min(t.scale + 0.15, 3) }))
  }

  function zoomOut() {
    setTransform((t) => ({ ...t, scale: Math.max(t.scale - 0.15, 0.4) }))
  }

  function resetZoom() {
    setTransform({ x: 0, y: 0, scale: 1 })
  }

  // Canvas Drag/Pan Handlers
  function handleCanvasMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    if (e.target instanceof SVGSVGElement || e.target instanceof SVGPathElement) {
      isDraggingCanvas.current = true
      dragStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y }
    }
  }

  function handleCanvasMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (isDraggingCanvas.current) {
      setTransform((t) => ({
        ...t,
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y,
      }))
    } else if (draggingNodeId) {
      // Node drag positioning
      const rect = svgRef.current?.getBoundingClientRect()
      if (rect) {
        const clientX = e.clientX - rect.left - transform.x
        const clientY = e.clientY - rect.top - transform.y
        // Scale conversion
        const nodeX = clientX / transform.scale
        const nodeY = clientY / transform.scale

        setNodes((prev) =>
          prev.map((n) => (n.id === draggingNodeId ? { ...n, x: nodeX, y: nodeY } : n))
        )
      }
    }
  }

  function handleCanvasMouseUp() {
    isDraggingCanvas.current = false
    setDraggingNodeId(null)
  }

  // Extract unique labels for filters legend
  const uniqueLabels = Array.from(new Set(nodes.map((n) => n.label)))

  // Filter nodes & links
  const filteredNodes = nodes.filter((n) => !filterLabel || n.label === filterLabel)
  const filteredNodeIds = new Set(filteredNodes.map((n) => n.id))
  const filteredLinks = links.filter((l) => filteredNodeIds.has(l.source) && filteredNodeIds.has(l.target))

  // Find relationships for selected node
  const activeRelationships = result?.relationships.filter(
    (r) => r.source === selectedNode?.id || r.target === selectedNode?.id
  ) || []

  // Check labels colors
  function getLabelColor(label: string) {
    switch (label.toLowerCase()) {
      case "technology":
        return "#19c37d" // emerald
      case "concept":
        return "#c084fc" // purple
      case "person":
        return "#f472b6" // pink
      case "organization":
        return "#60a5fa" // blue
      default:
        return "#f59e0b" // amber
    }
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#212121] text-[#ececec]">
      <AppHeader
        title="Graph Explorer"
        description="Explore extraction insights, zoom/pan nodes, inspect relations, and trace back source documents"
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4">
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
                  placeholder="Ask about your knowledge graph… e.g. “What technologies are related to RAG?”"
                  className="w-full bg-transparent border-0 outline-none py-3 text-[14px] text-[#ececec] placeholder-[#8e8e8e]"
                />
              </div>

              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => void runQuery("entity")}
                  disabled={loading || !query.trim()}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl border border-white/10 text-[13px] font-medium text-[#8e8e8e] hover:text-[#ececec] hover:border-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer bg-transparent"
                  title="Look up an exact entity name"
                >
                  <Tags className="size-4" />
                  <span className="hidden sm:inline">Entity</span>
                </button>

                <button
                  onClick={() => void runQuery("query")}
                  disabled={loading || !query.trim()}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-black text-[13px] font-semibold hover:bg-white/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
          </div>

          {/* Interactive Graphic Visualizer Grid */}
          {result && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Interactive SVG Canvas */}
              <div className="lg:col-span-2 rounded-2xl bg-[#2f2f2f] border border-white/10 overflow-hidden relative h-[450px] flex flex-col justify-between">
                {/* Control bar */}
                <div className="bg-[#242424]/85 border-b border-white/[0.08] px-4 py-2 flex items-center justify-between z-10">
                  <div className="flex items-center gap-1.5">
                    <Layers className="size-3.5 text-[#19c37d]" />
                    <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[#8e8e8e]">Interactive Visualizer</span>
                  </div>

                  {/* Legend Filters */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setFilterLabel(null)}
                      className={cn(
                        "text-[10px] px-2 py-0.5 rounded border border-white/10 transition-colors",
                        !filterLabel ? "bg-[#19c37d] text-black border-transparent font-semibold" : "bg-white/5 text-[#8e8e8e] hover:text-[#ececec]"
                      )}
                    >
                      All
                    </button>
                    {uniqueLabels.map((lbl) => (
                      <button
                        key={lbl}
                        onClick={() => setFilterLabel(lbl)}
                        className={cn(
                          "text-[10px] px-2 py-0.5 rounded border border-white/10 transition-colors",
                          filterLabel === lbl ? "text-black font-semibold border-transparent" : "bg-white/5 text-[#8e8e8e] hover:text-[#ececec]"
                        )}
                        style={filterLabel === lbl ? { backgroundColor: getLabelColor(lbl) } : {}}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>

                  {/* Zoom controls */}
                  <div className="flex items-center gap-1">
                    <button onClick={zoomIn} className="p-1 rounded hover:bg-white/10 text-white/70 hover:text-white" title="Zoom In"><ZoomIn className="size-3.5" /></button>
                    <button onClick={zoomOut} className="p-1 rounded hover:bg-white/10 text-white/70 hover:text-white" title="Zoom Out"><ZoomOut className="size-3.5" /></button>
                    <button onClick={resetZoom} className="p-1 rounded hover:bg-white/10 text-white/70 hover:text-white" title="Reset view"><Maximize2 className="size-3.5" /></button>
                  </div>
                </div>

                {/* SVG Visualizer Canvas */}
                <svg
                  ref={svgRef}
                  className="w-full h-full cursor-grab active:cursor-grabbing bg-[#252525]/30"
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseUp}
                >
                  <defs>
                    <marker
                      id="arrow"
                      viewBox="0 0 10 10"
                      refX="22"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#8e8e8e" opacity="0.6" />
                    </marker>
                  </defs>

                  <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
                    {/* Render Links / Lines */}
                    {filteredLinks.map((link, idx) => {
                      const sourceNode = nodes.find((n) => n.id === link.source)
                      const targetNode = nodes.find((n) => n.id === link.target)

                      if (!sourceNode || !targetNode) return null

                      return (
                        <g key={idx}>
                          <line
                            x1={sourceNode.x}
                            y1={sourceNode.y}
                            x2={targetNode.x}
                            y2={targetNode.y}
                            stroke="#555555"
                            strokeWidth={selectedNode?.id === sourceNode.id || selectedNode?.id === targetNode.id ? 2 : 1}
                            strokeOpacity={selectedNode ? (selectedNode.id === sourceNode.id || selectedNode.id === targetNode.id ? 1 : 0.25) : 0.6}
                            markerEnd="url(#arrow)"
                          />
                          {/* Relationship labels in middle of line */}
                          <text
                            x={(sourceNode.x + targetNode.x) / 2}
                            y={(sourceNode.y + targetNode.y) / 2 - 4}
                            fill="#8e8e8e"
                            fontSize="8px"
                            textAnchor="middle"
                            opacity={selectedNode ? (selectedNode.id === sourceNode.id || selectedNode.id === targetNode.id ? 1 : 0.15) : 0.7}
                            className="pointer-events-none select-none font-medium"
                          >
                            {link.type}
                          </text>
                        </g>
                      )
                    })}

                    {/* Render Nodes / Circles */}
                    {filteredNodes.map((node) => {
                      const color = getLabelColor(node.label)
                      const isSelected = selectedNode?.id === node.id
                      const isHovered = hoveredNode?.id === node.id

                      return (
                        <g
                          key={node.id}
                          transform={`translate(${node.x}, ${node.y})`}
                          onMouseEnter={() => setHoveredNode(node)}
                          onMouseLeave={() => setHoveredNode(null)}
                          onClick={() => setSelectedNode(node)}
                          onMouseDown={() => setDraggingNodeId(node.id)}
                          className="cursor-pointer"
                        >
                          <circle
                            r={isSelected ? 16 : isHovered ? 14 : 12}
                            fill={color}
                            fillOpacity={selectedNode ? (isSelected ? 1 : 0.35) : 0.85}
                            stroke={isSelected ? "#ffffff" : "transparent"}
                            strokeWidth={2}
                            className="transition-all duration-150"
                          />
                          <text
                            y={24}
                            textAnchor="middle"
                            fill={isSelected ? "#ffffff" : isHovered ? "#ececec" : "#8e8e8e"}
                            fontSize="9px"
                            fontWeight={isSelected ? "bold" : "normal"}
                            opacity={selectedNode ? (isSelected ? 1 : 0.4) : 1}
                            className="select-none font-medium pointer-events-none"
                          >
                            {node.name}
                          </text>
                        </g>
                      )
                    })}
                  </g>
                </svg>

                {/* Drag instruction notice */}
                <div className="absolute bottom-2 left-3 pointer-events-none text-[9.5px] text-[#8e8e8e] select-none bg-black/40 px-2 py-0.5 rounded backdrop-blur-xs">
                  Drag nodes to organize layout. Scroll to zoom, drag canvas to pan.
                </div>
              </div>

              {/* Node Inspector & Side Card */}
              <div className="rounded-2xl bg-[#2f2f2f] border border-white/10 p-5 flex flex-col justify-between h-[450px]">
                {selectedNode ? (
                  <div className="space-y-4 overflow-y-auto pr-1 h-full flex flex-col justify-between">
                    <div className="space-y-3.5">
                      <div className="flex items-start justify-between gap-2 border-b border-white/[0.08] pb-3">
                        <div>
                          <h3 className="text-[14.5px] font-bold text-[#ececec]">{selectedNode.name}</h3>
                          <span
                            className="inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase mt-1"
                            style={{ backgroundColor: `${getLabelColor(selectedNode.label)}20`, color: getLabelColor(selectedNode.label) }}
                          >
                            {selectedNode.label}
                          </span>
                        </div>
                      </div>

                      {/* Description */}
                      {selectedNode.description && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8e8e8e]">Description</span>
                          <p className="text-[12.5px] leading-5 text-white/90">{selectedNode.description}</p>
                        </div>
                      )}

                      {/* Relationships list */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8e8e8e]">Connected Links</span>
                        {activeRelationships.length === 0 ? (
                          <p className="text-xs text-[#8e8e8e]">No links for this node.</p>
                        ) : (
                          <div className="max-h-36 overflow-y-auto space-y-1.5">
                            {activeRelationships.map((r, idx) => (
                              <div key={idx} className="flex items-center gap-1.5 text-[11.5px] bg-white/5 border border-white/10 rounded px-2 py-1">
                                <span className="font-semibold text-white/90 truncate max-w-20">{r.source === selectedNode.id ? "This" : r.source}</span>
                                <ChevronRight className="size-3 text-[#8e8e8e] shrink-0" />
                                <span className="text-purple-300 uppercase text-[9.5px] tracking-wide font-medium bg-purple-500/10 border border-purple-500/20 px-1 rounded shrink-0">{r.relationshipType}</span>
                                <ChevronRight className="size-3 text-[#8e8e8e] shrink-0" />
                                <span className="font-semibold text-white/90 truncate max-w-20">{r.target === selectedNode.id ? "This" : r.target}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedNode(null)}
                      className="w-full text-center py-2 text-[12.5px] bg-white/5 border border-white/10 text-[#8e8e8e] hover:text-[#ececec] rounded-xl transition-all cursor-pointer font-semibold"
                    >
                      Deselect Node
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center h-full text-[#8e8e8e] space-y-2.5">
                    <Network className="size-8 text-[#8e8e8e]" />
                    <div>
                      <p className="text-[13px] font-semibold text-[#ececec]">No Node Selected</p>
                      <p className="text-[11.5px] max-w-xs mt-1">Click a node on the left visualizer to inspect relationships, parameters, and details.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Summary / Cypher Answers */}
          {result && result.summary && (
            <div className="rounded-2xl bg-[#2f2f2f] border border-white/10 p-5">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#8e8e8e]">
                Neo4j Extraction Summary
              </p>
              <p className="text-[14px] leading-6 text-[#ececec] whitespace-pre-wrap">
                {result.summary}
              </p>
            </div>
          )}

          {/* Sources list */}
          {result && result.sources.length > 0 && (
            <section className="space-y-2">
              <SectionTitle title="Grounded Source Documents" count={result.sources.length} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {result.sources.map((source, index) => (
                  <SourceRow key={index} source={source} />
                ))}
              </div>
            </section>
          )}

          {/* Initial hint */}
          {!result && stats.entities > 0 && (
            <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center bg-[#2f2f2f]/30">
              <Network className="mx-auto size-8 text-[#8e8e8e]" />
              <p className="mt-3 text-[14px] font-medium text-[#ececec]">
                Your knowledge graph is ready
              </p>
              <p className="mt-1 text-[12.5px] text-[#8e8e8e]">
                Ask a question above to see nodes and how they connect.
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

function SourceRow({
  source,
}: {
  source: GraphSourceRef
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-[#2f2f2f] border border-white/10 px-3.5 py-3">
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

"use client"

import { useState } from "react"
import type { Source } from "./chat.types"

interface CitationBadgeProps {
  source: Source
}

function getSourceLabel(source: Source): string {
  const name = source.fileName ?? "Unknown Source"
  if (source.slideNumber !== undefined) {
    return `${name} — Slide ${source.slideNumber}`
  }
  if (source.sheetName) {
    return `${name} — ${source.sheetName}`
  }
  if (source.pageNumber !== undefined && source.pageNumber > 0) {
    return `${name} — Page ${source.pageNumber}`
  }
  return name
}

export function CitationBadge({ source }: CitationBadgeProps) {
  const [expanded, setExpanded] = useState(false)
  const label = getSourceLabel(source)
  const score = source.relevanceScore ?? source.score ?? 0
  const scorePercent = Math.round(score * 100)

  return (
    <span className="citation-badge-wrapper">
      <button
        className="citation-badge"
        onClick={() => setExpanded((prev) => !prev)}
        aria-label={`Citation: ${label}`}
        title={`Relevance: ${scorePercent}%`}
      >
        <span className="citation-number">[{source.sourceNumber}]</span>
        <span className="citation-label">{label}</span>
        <span className="citation-score">{scorePercent}%</span>
      </button>

      {expanded && (
        <div className="citation-detail" role="tooltip">
          <div className="citation-detail-row">
            <span className="citation-detail-key">File</span>
            <span className="citation-detail-val">{source.fileName}</span>
          </div>
          {source.chunkId && (
            <div className="citation-detail-row">
              <span className="citation-detail-key">Chunk ID</span>
              <span className="citation-detail-val citation-mono">{source.chunkId.slice(0, 16)}…</span>
            </div>
          )}
          <div className="citation-detail-row">
            <span className="citation-detail-key">Relevance</span>
            <div className="citation-score-bar-wrap">
              <div className="citation-score-bar" style={{ width: `${scorePercent}%` }} />
              <span className="citation-score-label">{scorePercent}%</span>
            </div>
          </div>
        </div>
      )}
    </span>
  )
}

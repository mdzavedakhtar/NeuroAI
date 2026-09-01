"use client"

import { useState } from "react"
import { apiFetch } from "../../services/api"
import type { FeedbackRating } from "./chat.types"

interface FeedbackButtonsProps {
  messageId: string
  conversationId: string
  initialRating?: FeedbackRating
}

export function FeedbackButtons({ messageId, conversationId, initialRating }: FeedbackButtonsProps) {
  const [selected, setSelected] = useState<FeedbackRating | null>(initialRating ?? null)
  const [showReason, setShowReason] = useState(false)
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(!!initialRating)

  const submit = async (rating: FeedbackRating, reasonText?: string) => {
    if (loading) return
    setLoading(true)
    try {
      await apiFetch("/feedback", {
        method: "POST",
        body: JSON.stringify({ messageId, conversationId, rating, reason: reasonText ?? "" }),
      })
      setSelected(rating)
      setSubmitted(true)
      setShowReason(false)
    } catch {
      // silent — feedback is non-critical
    } finally {
      setLoading(false)
    }
  }

  const handleClick = (rating: FeedbackRating) => {
    if (submitted) return
    if (rating === "not_helpful") {
      setShowReason((prev) => !prev)
      setSelected(rating)
    } else {
      submit(rating)
    }
  }

  return (
    <div className="feedback-buttons-wrap">
      <span className="feedback-label">Was this helpful?</span>

      <button
        id={`feedback-helpful-${messageId}`}
        className={`feedback-btn ${selected === "helpful" ? "feedback-btn--active-pos" : ""}`}
        onClick={() => handleClick("helpful")}
        disabled={submitted || loading}
        aria-label="Mark as helpful"
        title="Helpful"
      >
        👍
      </button>

      <button
        id={`feedback-not-helpful-${messageId}`}
        className={`feedback-btn ${selected === "not_helpful" ? "feedback-btn--active-neg" : ""}`}
        onClick={() => handleClick("not_helpful")}
        disabled={submitted || loading}
        aria-label="Mark as not helpful"
        title="Not helpful"
      >
        👎
      </button>

      {submitted && (
        <span className="feedback-thanks">
          {selected === "helpful" ? "Thanks for the feedback! 🎉" : "Got it, we'll improve."}
        </span>
      )}

      {showReason && !submitted && (
        <div className="feedback-reason-wrap">
          <textarea
            id={`feedback-reason-${messageId}`}
            className="feedback-reason-input"
            placeholder="What was wrong? (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
          />
          <button
            id={`feedback-submit-reason-${messageId}`}
            className="feedback-submit-btn"
            onClick={() => submit("not_helpful", reason)}
            disabled={loading}
          >
            {loading ? "Submitting…" : "Submit"}
          </button>
        </div>
      )}
    </div>
  )
}

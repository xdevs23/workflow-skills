// Small presentation helpers — initials, avatar tint selection, and time/day
// formatting. No hardcoded color VALUES live here: the avatar tint is one of a fixed
// set of token-driven utility class names; this only PICKS which one deterministically.

// The six avatar tints from the mockup, each a token-backed gradient utility (see
// components/avatar.tsx for the class definitions). A stable hash maps a key
// (group name / identity id) to one slot so the same entity always gets the same
// tint.
export const AVATAR_TINTS = 6

export function tintIndex(key: string): number {
  let h = 0
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) >>> 0
  }
  return h % AVATAR_TINTS
}

// Up to two initials from a label (handle local part / display name).
export function initials(label: string): string {
  const cleaned = label.replace(/[^A-Za-z0-9]+/g, " ").trim()
  if (!cleaned) return "?"
  const parts = cleaned.split(/\s+/)
  if (parts.length === 1) {
    const p = parts[0] ?? ""
    return p.slice(0, 2).toUpperCase()
  }
  const a = parts[0]?.[0] ?? ""
  const b = parts[1]?.[0] ?? ""
  return (a + b).toUpperCase()
}

// HH:MM, local.
export function timeOf(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

// Relative-ish compact recency for the conversation list (now / 5m / 3h / Tue / date).
export function recency(iso: string | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const diff = Date.now() - d.getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return "now"
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const day = Math.floor(hr / 24)
  if (day < 7) return d.toLocaleDateString([], { weekday: "short" })
  return d.toLocaleDateString([], { month: "short", day: "numeric" })
}

// A day separator label for a message timestamp.
export function dayLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const today = new Date()
  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  const datePart = d.toLocaleDateString([], { month: "long", day: "numeric" })
  return isToday ? `Today · ${datePart}` : datePart
}

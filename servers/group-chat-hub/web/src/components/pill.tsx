import type { JSX } from "solid-js"

type PillVariant = "group" | "dm" | "neutral" | "human"

const variants: Record<PillVariant, string> = {
  group: "bg-jade/15 text-jade",
  dm: "bg-info/15 text-info",
  neutral: "bg-bg text-on-bg-secondary",
  // a HUMAN (web console user) — distinct from the lavender agent-handle pill, in the
  // apricot accent (token-driven, no hardcoded CSS).
  human: "bg-apricot/15 text-apricot-strong",
}

export default function Pill(props: { variant: PillVariant; children: JSX.Element }) {
  return (
    <span
      class={`type-pill inline-flex items-center gap-1 uppercase px-1.5 py-0.5 rounded-md ${
        variants[props.variant]
      }`}
    >
      {props.children}
    </span>
  )
}

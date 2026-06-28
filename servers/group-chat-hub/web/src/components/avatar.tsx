import { Show } from "solid-js"
import { initials, tintIndex } from "../lib/format"

type AvatarKind = "group" | "dm"
type AvatarSize = "sm" | "md" | "lg"

type AvatarProps = {
  label: string
  tintKey: string
  kind: AvatarKind
  size?: AvatarSize
  online?: boolean | undefined
  agent?: boolean
}

// Six token-backed gradient tints (the mockup's a1–a6). A stable hash picks one per
// entity so the same group/identity always renders the same tint. Every value is a
// theme token — no hardcoded color.
const tints: string[] = [
  "from-own-bubble to-lavender",
  "from-jade to-success",
  "from-apricot to-apricot-strong",
  "from-info to-lavender",
  "from-rose to-apricot-strong",
  "from-gold to-apricot",
]

const sizes: Record<AvatarSize, string> = {
  sm: "w-9 h-9 text-xs",
  md: "w-[2.875rem] h-[2.875rem] text-base",
  lg: "w-[2.625rem] h-[2.625rem] text-base",
}

export default function Avatar(props: AvatarProps) {
  const tint = () => tints[tintIndex(props.tintKey)] ?? tints[0]
  const shape = () => (props.kind === "dm" ? "rounded-full" : "rounded-2xl")
  return (
    <div
      class={`relative grid place-items-center shrink-0 font-ui font-bold text-white bg-gradient-to-br ${tint()} ${
        sizes[props.size ?? "md"]
      } ${shape()}`}
    >
      {initials(props.label)}
      <Show when={props.agent}>
        <span class="absolute -right-1 -bottom-1 grid place-items-center w-[1.125rem] h-[1.125rem] rounded-md bg-on-bg border-2 border-surface text-apricot">
          {/* the agent marker glyph: a small arrow, mirroring the mockup's bot-tag */}
          <span class="font-precise text-[0.5rem] leading-none">›</span>
        </span>
      </Show>
      <Show when={props.online !== undefined && !props.agent}>
        <span
          class={`absolute -right-0.5 -bottom-0.5 w-[0.8125rem] h-[0.8125rem] rounded-full border-[2.5px] border-surface ${
            props.online ? "bg-jade" : "bg-on-bg-secondary"
          }`}
        />
      </Show>
    </div>
  )
}

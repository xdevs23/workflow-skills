import { Show, type JSX } from "solid-js"
import Avatar from "./avatar"

type ThreadHeadProps = {
  title: string
  tintKey: string
  kind: "group" | "dm"
  subtitle: string
  online?: boolean | undefined
  actions?: JSX.Element
}

// The thread header: avatar, serif-role title (--font-data), a status subtitle, and
// optional right-aligned action buttons.
export default function ThreadHead(props: ThreadHeadProps) {
  return (
    <header class="flex items-center gap-3.5 px-6 py-4 border-b-2 border-border-subtle bg-surface shrink-0">
      <Avatar
        label={props.title}
        tintKey={props.tintKey}
        kind={props.kind}
        size="lg"
        online={props.online}
      />
      <div class="flex-1 min-w-0">
        <h2 class="font-data text-lg font-semibold tracking-tight text-on-surface truncate">
          {props.title}
        </h2>
        <div class="flex items-center gap-1.5 mt-0.5 font-data text-xs text-on-surface-secondary truncate">
          <Show when={props.online}>
            <span class="w-1.5 h-1.5 rounded-full bg-jade shrink-0" />
          </Show>
          <span class="truncate">{props.subtitle}</span>
        </div>
      </div>
      <Show when={props.actions}>
        <div class="flex items-center gap-2 shrink-0">{props.actions}</div>
      </Show>
    </header>
  )
}

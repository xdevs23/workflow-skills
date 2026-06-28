import { Show } from "solid-js"
import Reply from "lucide-solid/icons/reply"
import Target from "lucide-solid/icons/target"
import { timeOf } from "../lib/format"
import { renderMarkdown, renderInlineMarkdown } from "../lib/markdown"
import Avatar from "./avatar"
import Pill from "./pill"

export interface RowMessage {
  seq: number
  from: string
  ts: string
  text: string
  to?: string[] | undefined
}

type MessageRowProps = {
  msg: RowMessage
  author: string // display name for the meta line + avatar initials
  mine: boolean
  agent: boolean
  human: boolean // author's owning identity has the DERIVED role "human" (web console user)
  continuation: boolean // same author as the previous row → tighter, hide avatar/meta
  tintKey: string
  // `mine` here is the QUOTED message's origin: true → quote a sent (own) message, so
  // the snippet uses font-ui (Geist); false → received, font-message (Aleo).
  quote?: { who: string; text: string; mine: boolean } | undefined
  onReply: () => void
  onQuoteClick?: (() => void) | undefined
  // Click the author name to open a DM with the owning identity. Undefined / a no-op
  // for "You" or names with no resolvable owner.
  onAuthorClick?: (() => void) | undefined
}

// One message row: the mockup's bubble/avatar/meta language. Own messages flip to a
// deep-plum bubble on the right; others sit on a raised neutral surface on the left.
// Agent authors get a pastel-lavender mono handle. Reply quotes and the `→ to:`
// targeting marker render as proper chat UI.
export default function MessageRow(props: MessageRowProps) {
  return (
    <div
      class={`group/row flex gap-3 mt-3.5 max-w-[80%] ${
        props.mine ? "ml-auto flex-row-reverse" : ""
      } ${props.continuation ? "" : "first:mt-0"}`}
    >
      {/* avatar gutter — always reserves the sm-avatar width (w-9) so continuation
          rows (no avatar) stay aligned with the first row's bubble, not de-indented */}
      <div class="self-end shrink-0 w-9">
        <Show when={!props.continuation}>
          <Avatar
            label={props.author}
            tintKey={props.mine ? "self" : props.tintKey}
            kind="group"
            size="sm"
            agent={props.agent && !props.mine}
          />
        </Show>
      </div>

      <div class={`flex flex-col gap-1 min-w-0 ${props.mine ? "items-end" : ""}`}>
        {/* meta line */}
        <Show when={!props.continuation || (props.msg.to && props.msg.to.length > 0)}>
          <div class={`flex items-center gap-2 px-1 ${props.mine ? "flex-row-reverse" : ""}`}>
            <Show when={!props.continuation}>
              {/* Author name → DM the owning identity. "You" / unresolvable owners get
                  no handler and render as a plain (non-clickable) span. */}
              <Show
                when={!props.mine && props.onAuthorClick}
                fallback={
                  <Show
                    when={props.agent && !props.mine}
                    fallback={
                      <span class="type-data-label font-semibold text-on-surface">
                        {props.mine ? "You" : props.author}
                      </span>
                    }
                  >
                    <span class="type-precise-sm text-lavender bg-lavender/10 px-1.5 py-0.5 rounded-md">
                      {props.author}
                    </span>
                  </Show>
                }
              >
                <button
                  type="button"
                  onClick={() => props.onAuthorClick?.()}
                  title={`Direct message ${props.author}`}
                  class={`cursor-pointer rounded-md transition-colors ${
                    props.agent
                      ? "type-precise-sm text-lavender bg-lavender/10 hover:bg-lavender/20 px-1.5 py-0.5"
                      : "type-data-label font-semibold text-on-surface hover:text-apricot-strong"
                  }`}
                >
                  {props.author}
                </button>
              </Show>
              {/* human badge: ONLY when the author's identity has the derived role
                  "human" (a web console user). Agents are the unmarked default. */}
              <Show when={props.human && !props.mine}>
                <Pill variant="human">human</Pill>
              </Show>
              <span class="type-precise-sm text-on-surface-secondary">{timeOf(props.msg.ts)}</span>
            </Show>
            <Show when={props.msg.to && props.msg.to.length > 0}>
              <span class="type-precise-sm tracking-wide inline-flex items-center gap-1 text-apricot-strong bg-apricot/15 px-2 py-0.5 rounded-md">
                <Target class="w-3 h-3" /> to: {props.msg.to!.join(", ")}
              </span>
            </Show>
          </div>
        </Show>

        {/* bubble + hover reply affordance */}
        <div class={`flex items-end gap-1.5 ${props.mine ? "flex-row-reverse" : ""}`}>
          <div
            class={`px-3.5 py-2.5 text-[0.9375rem] leading-relaxed break-words ${
              props.mine
                ? "font-ui bg-own-bubble text-on-own-bubble rounded-2xl rounded-tr-[0.3125rem]"
                : "font-message bg-surface-raised text-on-surface-raised border border-border-subtle rounded-2xl rounded-tl-[0.3125rem]"
            } ${props.continuation ? "rounded-2xl" : ""}`}
          >
            <Show when={props.quote}>
              <button
                type="button"
                onClick={() => props.onQuoteClick?.()}
                class={`block w-full text-left mb-2 px-2.5 py-1.5 rounded-r-lg border-l-[3px] cursor-pointer ${
                  props.mine
                    ? "border-gold bg-on-own-bubble/10"
                    : "border-apricot bg-apricot/10"
                }`}
              >
                <div
                  class={`type-precise-sm font-bold ${
                    props.mine ? "text-gold" : "text-apricot-strong"
                  }`}
                >
                  {props.quote!.who}
                </div>
                {/* The snippet text uses the QUOTED message's origin font: a quoted
                    sent message → font-ui (Geist); a quoted received message →
                    font-message (Aleo). Rendered inline-markdown, one line. */}
                <div
                  class={`md-inline text-xs mt-0.5 line-clamp-2 ${
                    props.quote!.mine ? "font-ui" : "font-message"
                  } ${props.mine ? "text-on-own-bubble/75" : "text-on-surface-secondary"}`}
                  innerHTML={renderInlineMarkdown(props.quote!.text)}
                />
              </button>
            </Show>
            <div class="md" innerHTML={renderMarkdown(props.msg.text)} />
          </div>

          <button
            type="button"
            onClick={() => props.onReply()}
            title="Reply"
            class={`opacity-0 group-hover/row:opacity-100 cursor-pointer grid place-items-center w-9 h-9 rounded-xl border transition-all ${
              props.mine
                ? "border-own-bubble bg-own-bubble text-on-own-bubble hover:brightness-110"
                : "border-border bg-surface-raised text-on-surface-raised hover:bg-hover-on-surface-raised hover:text-on-surface"
            }`}
          >
            <Reply class="w-[1.125rem] h-[1.125rem]" />
          </button>
        </div>
      </div>
    </div>
  )
}

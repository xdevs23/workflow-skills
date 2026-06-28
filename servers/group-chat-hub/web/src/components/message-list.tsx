import { For, Show, createEffect, createMemo, onMount } from "solid-js"
import type { ChatMessage } from "../lib/protocol"
import { dayLabel } from "../lib/format"
import MessageRow from "./message-row"

type MessageListProps = {
  messages: ChatMessage[]
  // Resolve per-message presentation from the author's member name.
  mineOf: (from: string) => boolean
  agentOf: (from: string) => boolean
  // Author's owning identity has the DERIVED role "human" (web console user). Omitted
  // in contexts with no member→identity mapping; defaults to never-human there.
  humanOf?: ((from: string) => boolean) | undefined
  tintOf: (from: string) => string
  displayOf: (from: string) => string
  onReply: (msg: ChatMessage) => void
  // Click an author name to DM the owning identity. Omitted in contexts with no
  // member→identity mapping (e.g. DMs); the row then renders the name non-clickable.
  onAuthorClick?: ((from: string) => void) | undefined
}

function sameDay(a: string, b: string): boolean {
  const da = new Date(a)
  const db = new Date(b)
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  )
}

// The scrollable message column: day separators, author-continuation grouping, reply
// quotes (looked up by reply_to seq within the same thread), and auto-scroll to the
// latest message as the stream advances.
export default function MessageList(props: MessageListProps) {
  let scroller: HTMLDivElement | undefined

  function scrollToBottom() {
    if (scroller) scroller.scrollTop = scroller.scrollHeight
  }
  onMount(scrollToBottom)
  // Re-scroll whenever the message count changes (a new append via the stream).
  createEffect(() => {
    props.messages.length
    queueMicrotask(scrollToBottom)
  })

  // Build the seq→message index once per messages-array change (reply-quote lookups
  // read it once per replied row; a plain thunk would rebuild it O(N) on every read).
  const bySeq = createMemo(() => {
    const m = new Map<number, ChatMessage>()
    for (const msg of props.messages) m.set(msg.seq, msg)
    return m
  })

  return (
    <div ref={scroller} class="flex-1 overflow-y-auto px-7 pt-6 pb-2 flex flex-col min-h-0">
      <Show
        when={props.messages.length > 0}
        fallback={
          <div class="m-auto font-data text-sm text-on-surface-secondary text-center leading-relaxed">
            No messages yet.<br />Say something to start the thread.
          </div>
        }
      >
        <For each={props.messages}>
          {(msg, i) => {
            const prev = () => props.messages[i() - 1]
            const showDay = () => {
              const p = prev()
              return !p || !sameDay(p.ts, msg.ts)
            }
            const continuation = () => {
              const p = prev()
              return !!p && p.from === msg.from && !showDay()
            }
            const quote = () => {
              if (msg.reply_to === undefined) return undefined
              const target = bySeq().get(msg.reply_to)
              if (!target) return undefined
              // `mine` = the quoted message's own/received origin → drives the snippet
              // font (font-ui for sent, font-message for received).
              return {
                who: props.displayOf(target.from),
                text: target.text,
                mine: props.mineOf(target.from),
              }
            }
            return (
              <>
                <Show when={showDay()}>
                  <div class="flex justify-center my-4">
                    <span class="font-data text-xs font-semibold text-on-surface-secondary bg-surface-raised px-3.5 py-1 rounded-full">
                      {dayLabel(msg.ts)}
                    </span>
                  </div>
                </Show>
                <MessageRow
                  msg={msg}
                  author={props.displayOf(msg.from)}
                  mine={props.mineOf(msg.from)}
                  agent={props.agentOf(msg.from)}
                  human={props.humanOf?.(msg.from) ?? false}
                  continuation={continuation()}
                  tintKey={props.tintOf(msg.from)}
                  quote={quote()}
                  onReply={() => props.onReply(msg)}
                  onAuthorClick={
                    props.onAuthorClick ? () => props.onAuthorClick!(msg.from) : undefined
                  }
                />
              </>
            )
          }}
        </For>
      </Show>
    </div>
  )
}

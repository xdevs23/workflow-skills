import { createSignal, For, Show, onCleanup } from "solid-js"
import Paperclip from "lucide-solid/icons/paperclip"
import AtSign from "lucide-solid/icons/at-sign"
import Smile from "lucide-solid/icons/smile"
import Send from "lucide-solid/icons/send"
import ReplyIcon from "lucide-solid/icons/reply"
import X from "lucide-solid/icons/x"
import Target from "lucide-solid/icons/target"
import { renderInlineMarkdown } from "../lib/markdown"

export interface ReplyTarget {
  seq: number
  who: string
  text: string
}

type ComposerProps = {
  placeholder: string
  reply?: ReplyTarget | undefined
  onClearReply?: (() => void) | undefined
  // Member names available as `to:` targets (group threads only; undefined for DMs).
  targets?: string[] | undefined
  onSend: (text: string, opts: { to: string[]; reply_to?: number }) => void
}

// The composer: dismissible reply chip + `to:` targeting chips, then the input bar.
// Mirrors the mockup's composer; targeting is restricted to current group members.
export default function Composer(props: ComposerProps) {
  const [text, setText] = createSignal("")
  const [to, setTo] = createSignal<string[]>([])
  const [pickerOpen, setPickerOpen] = createSignal(false)
  let pickerRef: HTMLDivElement | undefined
  let pickerBtnRef: HTMLButtonElement | undefined

  function onDocPointer(e: PointerEvent) {
    const t = e.target as Node
    if (pickerRef?.contains(t) || pickerBtnRef?.contains(t)) return
    setPickerOpen(false)
  }
  document.addEventListener("pointerdown", onDocPointer)
  onCleanup(() => document.removeEventListener("pointerdown", onDocPointer))

  function toggleTarget(name: string) {
    setTo((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]))
  }

  function submit() {
    const t = text().trim()
    if (!t) return
    props.onSend(t, { to: to(), reply_to: props.reply?.seq })
    setText("")
    setTo([])
    props.onClearReply?.()
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div class="px-[1.375rem] pt-3.5 pb-5 border-t-2 border-border-subtle bg-surface">
      {/* reply chip */}
      <Show when={props.reply}>
        <div class="flex items-center gap-2.5 mb-2.5 px-3 py-2 rounded-r-xl border-l-[3px] border-apricot bg-apricot/10">
          <div class="flex-1 min-w-0">
            <div class="type-label font-bold text-apricot-strong flex items-center gap-1.5">
              <ReplyIcon class="w-3 h-3" /> Replying to {props.reply!.who}
            </div>
            <div
              class="md-inline font-data text-xs text-on-surface-secondary truncate mt-0.5"
              innerHTML={renderInlineMarkdown(props.reply!.text)}
            />
          </div>
          <button
            type="button"
            onClick={() => props.onClearReply?.()}
            title="Cancel reply"
            class="grid place-items-center w-6 h-6 rounded-lg shrink-0 cursor-pointer text-apricot-strong bg-apricot/15 hover:bg-apricot hover:text-on-send transition-colors"
          >
            <X class="w-3.5 h-3.5" />
          </button>
        </div>
      </Show>

      {/* target chips */}
      <Show when={to().length > 0}>
        <div class="flex flex-wrap gap-2 mb-2.5">
          <For each={to()}>
            {(name) => (
              <span class="inline-flex items-center gap-1.5 type-precise-sm pl-2.5 pr-1.5 py-1 rounded-lg bg-on-bg text-bg">
                <Target class="w-3 h-3" /> to: {name}
                <button
                  type="button"
                  onClick={() => toggleTarget(name)}
                  class="grid place-items-center w-4 h-4 rounded cursor-pointer bg-bg/20 hover:bg-apricot-strong transition-colors"
                >
                  <X class="w-2.5 h-2.5" />
                </button>
              </span>
            )}
          </For>
        </div>
      </Show>

      {/* compose bar */}
      <div class="relative flex items-end gap-2 p-2 rounded-2xl bg-surface-raised border border-border-subtle focus-within:border-apricot transition-colors">
        <button
          type="button"
          title="Attach"
          class="grid place-items-center w-10 h-10 rounded-xl shrink-0 cursor-pointer text-on-surface-secondary hover:bg-hover-on-surface-raised hover:text-on-surface transition-colors"
        >
          <Paperclip class="w-5 h-5" />
        </button>

        <Show when={props.targets && props.targets.length > 0}>
          <button
            ref={pickerBtnRef}
            type="button"
            title="Target members (to:)"
            onClick={() => setPickerOpen((o) => !o)}
            class={`grid place-items-center w-10 h-10 rounded-xl shrink-0 cursor-pointer transition-colors ${
              to().length > 0 || pickerOpen()
                ? "text-apricot-strong"
                : "text-on-surface-secondary hover:bg-hover-on-surface-raised hover:text-on-surface"
            }`}
          >
            <AtSign class="w-5 h-5" />
          </button>
        </Show>

        <textarea
          value={text()}
          onInput={(e) => setText(e.currentTarget.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder={props.placeholder}
          class="flex-1 resize-none bg-transparent border-none outline-none type-data-body font-ui text-on-surface placeholder-on-surface-secondary py-2.5 px-1 max-h-32"
        />

        <button
          type="button"
          title="Emoji"
          class="grid place-items-center w-10 h-10 rounded-xl shrink-0 cursor-pointer text-on-surface-secondary hover:bg-hover-on-surface-raised hover:text-on-surface transition-colors"
        >
          <Smile class="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={submit}
          title="Send"
          class="grid place-items-center w-11 h-11 rounded-xl shrink-0 cursor-pointer bg-gradient-to-br from-apricot to-apricot-strong text-on-send hover:brightness-105 transition-all"
        >
          <Send class="w-5 h-5" />
        </button>

        {/* target picker popover */}
        <Show when={pickerOpen()}>
          <div
            ref={pickerRef}
            class="absolute bottom-full left-0 mb-2 w-64 max-h-64 overflow-y-auto rounded-xl bg-surface-raised border-2 border-border shadow-lg z-30 p-1"
          >
            <div class="type-label font-bold uppercase tracking-wide text-on-surface-raised-secondary px-3 py-2">
              Target members
            </div>
            <For each={props.targets}>
              {(name) => (
                <button
                  type="button"
                  onClick={() => toggleTarget(name)}
                  class={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left cursor-pointer transition-colors ${
                    to().includes(name)
                      ? "bg-bg text-on-bg font-medium"
                      : "text-on-surface-raised-secondary hover:bg-hover-on-surface-raised hover:text-on-surface-raised"
                  }`}
                >
                  <span class="font-data text-sm truncate">{name}</span>
                  <Show when={to().includes(name)}>
                    <Target class="w-3.5 h-3.5 text-apricot-strong shrink-0" />
                  </Show>
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  )
}

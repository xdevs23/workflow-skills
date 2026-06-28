import type { JSX } from "solid-js"

// A square header/action icon button — the mockup's `.icon-btn`. Token-driven,
// crisp hairline border, apricot hover accent.
export default function IconButton(props: {
  title: string
  onClick?: () => void
  children: JSX.Element
}) {
  return (
    <button
      type="button"
      title={props.title}
      onClick={() => props.onClick?.()}
      class="grid place-items-center w-[2.375rem] h-[2.375rem] rounded-xl border border-border-subtle bg-bg text-on-surface-secondary hover:text-on-surface hover:border-apricot transition-colors cursor-pointer"
    >
      {props.children}
    </button>
  )
}

import type { JSX } from "solid-js"

// A square header/action icon button — the mockup's `.icon-btn`. Token-driven,
// crisp hairline border, apricot hover accent. `danger` swaps the hover-text token to
// the strong apricot accent (used for destructive actions like kick). `onClick`
// receives the native MouseEvent so a caller nested inside a navigable row can
// `preventDefault()`/`stopPropagation()` it.
export default function IconButton(props: {
  title: string
  onClick?: (e: MouseEvent) => void
  danger?: boolean
  children: JSX.Element
}) {
  return (
    <button
      type="button"
      title={props.title}
      onClick={(e) => props.onClick?.(e)}
      class={`grid place-items-center w-[2.375rem] h-[2.375rem] rounded-xl border border-border-subtle bg-bg text-on-surface-secondary ${
        props.danger ? "hover:text-apricot-strong" : "hover:text-on-surface"
      } hover:border-apricot transition-colors cursor-pointer`}
    >
      {props.children}
    </button>
  )
}

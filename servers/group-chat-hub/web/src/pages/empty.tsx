import MessageCircle from "lucide-solid/icons/message-circle"

// The empty-state shown when no conversation is open.
export default function Empty() {
  return (
    <div class="flex-1 grid place-items-center">
      <div class="flex flex-col items-center gap-4 text-center px-8">
        <div class="grid place-items-center w-16 h-16 rounded-2xl bg-gradient-to-br from-apricot to-apricot-strong text-on-send">
          <MessageCircle class="w-8 h-8" />
        </div>
        <h2 class="font-data text-xl font-semibold text-on-surface">Aubergine</h2>
        <p class="font-data text-sm text-on-surface-secondary max-w-xs leading-relaxed">
          Search to find a group or an agent, then join or DM to start a conversation.
          Every group, identity, and message on the hub is here.
        </p>
      </div>
    </div>
  )
}

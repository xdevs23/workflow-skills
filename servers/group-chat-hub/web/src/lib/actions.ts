import { send } from "./connection"

// The console's participant actions. Each sends the EXISTING v6 frame; the hub
// mutation echoes back as a stream event — the browser does NOT optimistically
// mutate its own store. One write path, one read path.

export function joinGroup(group: string, as: string): void {
  send({ t: "join", group, as })
}

export function leaveGroup(group: string): void {
  send({ t: "leave", group })
}

// PRIVILEGED kick: remove another member from a group. The removed member vanishes
// when the `member_remove` firehose event echoes back — no optimistic store mutation.
export function removeMember(group: string, name: string): void {
  send({ t: "remove_member", group, name })
}

export function sendMessage(
  group: string,
  message: string,
  opts?: { to?: string[]; reply_to?: number },
): void {
  send({ t: "send", group, message, to: opts?.to, reply_to: opts?.reply_to })
}

export function sendDm(to: string, message: string): void {
  send({ t: "dm", to, message })
}

export function registerAlias(name: string): void {
  send({ t: "register_alias", name })
}

export function releaseAlias(name: string): void {
  send({ t: "release_alias", name })
}

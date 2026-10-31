"""The record of printed events that lets a restarted watch print only what is new or edited."""

import enum
import json
from pathlib import Path


class EventStatus(enum.Enum):
    NEW = enum.auto()  # not printed before
    EDITED = enum.auto()  # printed before with another body
    PRINTED = enum.auto()  # printed before with this body


class EventLog:
    """The events printed so far, read from the state file at start and written to it after a poll.

    The file maps the id of every printed event to the digest of its body, or to null for an event
    without a body. A file written by an earlier version of the watcher contains a list of ids
    without digests. Its events count as printed with the body they have at the next poll, so a
    watch restarted on such a file does not print them again."""

    def __init__(self, path: Path) -> None:
        self.path = path
        stored = json.loads(path.read_text()) if path.exists() else {}
        self.digests: dict[str, str | None] = dict.fromkeys(stored) if isinstance(stored, list) else stored
        self.changed = False
        path.parent.mkdir(parents=True, exist_ok=True)

    def note(self, key: str, digest: str | None) -> EventStatus:
        """Records the digest of the body of an event and returns whether the event was printed before."""
        known = key in self.digests
        printed = self.digests.get(key)
        if not known or printed != digest:
            self.digests[key] = digest
            self.changed = True
        if not known:
            return EventStatus.NEW
        # A digest of null belongs to an event without a body, or to an event printed by an earlier
        # version that kept no digests. Both count as printed.
        return EventStatus.PRINTED if printed in (None, digest) else EventStatus.EDITED

    def save(self) -> None:
        if not self.changed:
            return
        # Replace the file in one step, so a watch stopped mid-write leaves the previous state whole.
        partial = self.path.with_name(self.path.name + ".partial")
        partial.write_text(json.dumps(self.digests))
        partial.replace(self.path)
        self.changed = False

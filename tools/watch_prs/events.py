"""The events the watcher prints, one JSON line each."""

import enum
import json
from dataclasses import asdict, dataclass
from operator import attrgetter
from typing import ClassVar, Protocol


class EventKind(enum.Enum):
    WATCHING = "watching"
    COMMENT = "comment"
    REVIEW = "review"
    REVIEW_COMMENT = "review-comment"
    CHECK_FAILED = "check-failed"
    STATUS_FAILED = "status-failed"
    CONFLICT = "conflict"
    MERGED = "merged"
    CLOSED = "closed"
    POLL_ERROR = "poll-error"
    REFUSED = "refused"
    RATE_LIMIT_UNREADABLE = "rate-limit-unreadable"
    LOGIN_LOST = "login-lost"
    DONE = "done"


class Event(Protocol):
    def fields(self) -> dict[str, object]:
        """The fields printed for the event, its kind among them."""


@dataclass(frozen=True)
class EventRecord:
    """An event printed as its kind and the fields of its dataclass."""

    kind: ClassVar[EventKind]

    def fields(self) -> dict[str, object]:
        return {"kind": self.kind, **asdict(self)}


@dataclass(frozen=True)
class Watching(EventRecord):
    kind: ClassVar[EventKind] = EventKind.WATCHING
    prs: tuple[str, ...]


@dataclass(frozen=True)
class Merged(EventRecord):
    kind: ClassVar[EventKind] = EventKind.MERGED
    pr: str


@dataclass(frozen=True)
class Closed(EventRecord):
    kind: ClassVar[EventKind] = EventKind.CLOSED
    pr: str


@dataclass(frozen=True)
class PollFailed(EventRecord):
    kind: ClassVar[EventKind] = EventKind.POLL_ERROR
    pr: str
    stderr: str


@dataclass(frozen=True)
class Refused(EventRecord):
    kind: ClassVar[EventKind] = EventKind.REFUSED
    path: str
    seconds: float  # the wait named by GitHub before the request is sent again


@dataclass(frozen=True)
class RateLimitUnreadable(EventRecord):
    kind: ClassVar[EventKind] = EventKind.RATE_LIMIT_UNREADABLE
    stderr: str


@dataclass(frozen=True)
class LoginLost(EventRecord):
    kind: ClassVar[EventKind] = EventKind.LOGIN_LOST
    stderr: str


@dataclass(frozen=True)
class Done(EventRecord):
    kind: ClassVar[EventKind] = EventKind.DONE


def emit(event: Event) -> None:
    # A value of an enum, such as the state of a review, prints as its text.
    print(json.dumps(event.fields(), default=attrgetter("value"), ensure_ascii=False), flush=True)

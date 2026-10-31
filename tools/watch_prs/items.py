"""The items on a pull request that the watcher prints as events, read from the responses of GitHub."""

import enum
import hashlib
from dataclasses import dataclass
from typing import ClassVar

from .events import EventKind, EventRecord
from .payloads import CheckRunPayload, CommentPayload, ReviewCommentPayload, ReviewPayload, StatusPayload

DELETED_ACCOUNT_LOGIN = "ghost"  # the login GitHub shows for a deleted account


class ReviewState(enum.Enum):
    APPROVED = "APPROVED"
    CHANGES_REQUESTED = "CHANGES_REQUESTED"
    COMMENTED = "COMMENTED"
    DISMISSED = "DISMISSED"
    PENDING = "PENDING"
    UNKNOWN = "unknown"

    @classmethod
    def _missing_(cls, value: object) -> "ReviewState":
        return cls.UNKNOWN


class StatusState(enum.Enum):
    ERROR = "error"
    FAILURE = "failure"
    PENDING = "pending"
    SUCCESS = "success"
    UNKNOWN = "unknown"

    @classmethod
    def _missing_(cls, value: object) -> "StatusState":
        return cls.UNKNOWN

    @property
    def failed(self) -> bool:
        return self in (StatusState.ERROR, StatusState.FAILURE)


def author(item: CommentPayload) -> str:
    user = item["user"]
    return user["login"] if user else DELETED_ACCOUNT_LOGIN


@dataclass(frozen=True)
class Comment(EventRecord):
    kind: ClassVar[EventKind] = EventKind.COMMENT
    author: str
    url: str
    body: str | None

    @classmethod
    def from_json(cls, comment: CommentPayload) -> "Comment":
        return cls(author(comment), comment["html_url"], comment["body"])


@dataclass(frozen=True)
class Review(EventRecord):
    kind: ClassVar[EventKind] = EventKind.REVIEW
    state: ReviewState
    author: str
    url: str
    body: str | None
    commit: str

    @classmethod
    def from_json(cls, review: ReviewPayload) -> "Review":
        return cls(ReviewState(review["state"]), author(review), review["html_url"], review["body"],
                   review["commit_id"])


@dataclass(frozen=True)
class ReviewComment(EventRecord):
    kind: ClassVar[EventKind] = EventKind.REVIEW_COMMENT
    author: str
    url: str
    path: str
    line: int | None
    in_reply_to: int | None
    body: str | None
    commit: str

    @classmethod
    def from_json(cls, comment: ReviewCommentPayload) -> "ReviewComment":
        return cls(author(comment), comment["html_url"], comment["path"], comment.get("line"),
                   comment.get("in_reply_to_id"), comment["body"], comment["commit_id"])


@dataclass(frozen=True)
class CheckRun(EventRecord):
    kind: ClassVar[EventKind] = EventKind.CHECK_FAILED
    name: str
    conclusion: str | None
    url: str
    commit: str

    @classmethod
    def from_json(cls, run: CheckRunPayload, commit: str) -> "CheckRun":
        return cls(run["name"], run["conclusion"], run["html_url"], commit)


@dataclass(frozen=True)
class CommitStatus(EventRecord):
    kind: ClassVar[EventKind] = EventKind.STATUS_FAILED
    name: str
    state: StatusState
    url: str | None
    commit: str

    @classmethod
    def from_json(cls, status: StatusPayload, commit: str) -> "CommitStatus":
        return cls(status["context"], StatusState(status["state"]), status["target_url"], commit)


@dataclass(frozen=True)
class Conflict(EventRecord):
    kind: ClassVar[EventKind] = EventKind.CONFLICT
    base: str  # the name of the base branch


ItemEvent = Comment | Review | ReviewComment | CheckRun | CommitStatus | Conflict


@dataclass(frozen=True)
class Item:
    key: str  # identifies the item on its pull request across polls, such as ic101 for issue comment 101
    digest: str | None  # the digest of the body, None for an item that has no body
    event: ItemEvent

    @classmethod
    def with_body(cls, prefix: str, payload: CommentPayload, event: ItemEvent) -> "Item":
        # A body sent as null counts as empty text.
        body = payload["body"] or ""
        return cls(f"{prefix}{payload['id']}", hashlib.sha256(body.encode()).hexdigest(), event)


@dataclass(frozen=True)
class ItemFound:
    """The event of an item with the pull request and the head commit of the poll that found it."""

    pr: str
    head: str
    event: ItemEvent
    edited: bool  # whether the item was printed before with another body

    def fields(self) -> dict[str, object]:
        # An item printed for the first time carries no edited field.
        edited = {"edited": True} if self.edited else {}
        return {"pr": self.pr, "head": self.head, **self.event.fields(), **edited}

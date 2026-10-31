"""The parts of the responses sent by GitHub that the watcher reads, in the shape GitHub sends them."""

from typing import TypedDict


class UserPayload(TypedDict):
    login: str


class CommentPayload(TypedDict):
    id: int
    user: UserPayload | None  # null for a deleted account
    html_url: str
    body: str | None


class ReviewPayload(CommentPayload):
    state: str
    commit_id: str


class ReviewCommentRequiredPayload(CommentPayload):
    path: str
    commit_id: str


class ReviewCommentPayload(ReviewCommentRequiredPayload, total=False):
    line: int | None
    in_reply_to_id: int  # only on a reply in a review thread


class CheckRunPayload(TypedDict):
    id: int
    name: str
    status: str
    conclusion: str | None
    html_url: str


class CheckRunPagePayload(TypedDict):
    check_runs: list[CheckRunPayload]


class StatusPayload(TypedDict):
    id: int
    context: str
    state: str
    target_url: str | None


class StatusPagePayload(TypedDict):
    statuses: list[StatusPayload]


class HeadPayload(TypedDict):
    sha: str


class BasePayload(TypedDict):
    ref: str


class PullRequestPayload(TypedDict):
    state: str
    merged: bool
    mergeable: bool | None
    head: HeadPayload
    base: BasePayload


class PullRequestSummaryPayload(TypedDict):
    number: int


class CoreLimitPayload(TypedDict):
    used: int
    remaining: int
    reset: int


class LimitResourcesPayload(TypedDict):
    core: CoreLimitPayload


class RateLimitPayload(TypedDict):
    resources: LimitResourcesPayload

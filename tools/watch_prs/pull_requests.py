"""One poll of a pull request: its state and every item on it that is new or edited."""

import enum
from dataclasses import dataclass

from .event_log import EventLog, EventStatus
from .events import Closed, Merged, emit
from .github import GitHub, flat
from .items import (CheckRun, Comment, CommitStatus, Conflict, Item, ItemFound, Review, ReviewComment,
                    ReviewState)
from .payloads import (CheckRunPagePayload, CommentPayload, PullRequestPayload, ReviewCommentPayload,
                       ReviewPayload, StatusPagePayload)
from .targets import ByNumber

FAILED_CONCLUSIONS = {"failure", "timed_out", "cancelled", "action_required", "startup_failure"}


class PullRequestState(enum.Enum):
    OPEN = "open"
    CLOSED = "closed"
    MERGED = "merged"

    @property
    def end(self) -> type[Closed] | type[Merged] | None:
        """The event printed when a poll finds the pull request in this state, None while it is open."""
        return {PullRequestState.CLOSED: Closed, PullRequestState.MERGED: Merged}.get(self)


@dataclass(frozen=True)
class PullRequest:
    head: str  # the sha of the head commit
    base: str  # the name of the base branch
    state: PullRequestState
    # Whether GitHub can merge the head into the base without a conflict, None while GitHub computes
    # it (see https://docs.github.com/en/rest/pulls/pulls#get-a-pull-request, checked 2026-10-31).
    mergeable: bool | None

    @classmethod
    def from_json(cls, pr: PullRequestPayload) -> "PullRequest":
        # A merged pull request has the state closed too (see the page linked at mergeable).
        state = (PullRequestState.MERGED if pr["merged"]
                 else PullRequestState.CLOSED if pr["state"] == "closed" else PullRequestState.OPEN)
        return cls(pr["head"]["sha"], pr["base"]["ref"], state, pr["mergeable"])

    @property
    def conflicting(self) -> bool:
        # Only an open pull request can take the push that resolves a conflict.
        return self.state is PullRequestState.OPEN and self.mergeable is False


def comments(github: GitHub, pr: ByNumber) -> list[Item]:
    payloads: list[CommentPayload] = flat(github.pages(f"repos/{pr.repo}/issues/{pr.number}/comments"))
    return [Item.with_body("ic", comment, Comment.from_json(comment)) for comment in payloads]


def reviews(github: GitHub, pr: ByNumber) -> list[Item]:
    payloads: list[ReviewPayload] = flat(github.pages(f"repos/{pr.repo}/pulls/{pr.number}/reviews"))
    return [Item.with_body("rv", payload, review) for payload in payloads
            if (review := Review.from_json(payload)).state is not ReviewState.PENDING]


def review_comments(github: GitHub, pr: ByNumber) -> list[Item]:
    payloads: list[ReviewCommentPayload] = flat(github.pages(f"repos/{pr.repo}/pulls/{pr.number}/comments"))
    return [Item.with_body("rc", comment, ReviewComment.from_json(comment)) for comment in payloads]


def failed_check_runs(github: GitHub, pr: ByNumber, head: str) -> list[Item]:
    pages: list[CheckRunPagePayload] = github.pages(f"repos/{pr.repo}/commits/{head}/check-runs")
    return [Item(f"ck{run['id']}", None, CheckRun.from_json(run, head))
            for page in pages for run in page["check_runs"]
            if run["status"] == "completed" and run["conclusion"] in FAILED_CONCLUSIONS]


def failed_statuses(github: GitHub, pr: ByNumber, head: str) -> list[Item]:
    pages: list[StatusPagePayload] = github.pages(f"repos/{pr.repo}/commits/{head}/status")
    return [Item(f"st{payload['id']}", None, status) for page in pages for payload in page["statuses"]
            if (status := CommitStatus.from_json(payload, head)).state.failed]


def conflicts(pr: PullRequest) -> list[Item]:
    # A conflict is printed once per head, since resolving it in the pull request pushes a new head.
    return [Item(f"cf{pr.head}", None, Conflict(pr.base))] if pr.conflicting else []


def poll(github: GitHub, target: ByNumber, log: EventLog) -> bool:
    """Prints every event on the pull request that is new or edited, and returns whether it is still open."""
    payload: PullRequestPayload = github.get(f"repos/{target.repo}/pulls/{target.number}").body
    pr = PullRequest.from_json(payload)
    items = [*comments(github, target), *reviews(github, target), *review_comments(github, target),
             *failed_check_runs(github, target, pr.head), *failed_statuses(github, target, pr.head), *conflicts(pr)]
    for item in items:
        status = log.note(f"{target}:{item.key}", item.digest)
        if status is not EventStatus.PRINTED:
            emit(ItemFound(str(target), pr.head, item.event, edited=status is EventStatus.EDITED))
    if (end := pr.state.end) is not None:
        emit(end(str(target)))
        return False
    return True

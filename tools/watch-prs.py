#!/usr/bin/env python3
"""Watch pull requests with the GitHub CLI and print one JSON line per new event.

Run as `watch-prs.py --state <file> <pull request>...`. A pull request is named as
`owner/repo#number`, or as `owner/repo@branch` for the open pull request whose head is that branch.

The watcher prints every issue comment, review other than a pending one, review thread comment,
failed check run and failed commit status on the head commit of each pull request, and the pull
request closing or merging. The state file contains the id of every printed event, so a restarted
watch prints only what is new. The tool exits when every pull request is closed or merged.

A request carries the ETag of the last full response to the same path, so a page that did not change
costs nothing against the REST rate limit of the gh login. Between two rounds of polls the watcher
waits as the class Pacer describes.
"""

import argparse
import enum
import http.client
import io
import itertools
import json
import re
import subprocess
import sys
import time
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass
from email.message import Message
from email.utils import parsedate_to_datetime
from http import HTTPStatus
from pathlib import Path
from urllib.parse import urlencode

FAILED_CONCLUSIONS = {"failure", "timed_out", "cancelled", "action_required", "startup_failure"}
# The largest page GitHub serves for most lists, accepted as a limit of GitHub on 2026-10-22 from
# https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api (checked
# 2026-10-22). A list is read up to the page without a next page in its Link header, so a smaller
# page served by GitHub only costs more requests.
PAGE_SIZE = 100
# The wait GitHub asks for after a refusal over a rate limit that names no wait, accepted as a limit
# of GitHub on 2026-10-22 from the page that retry_wait names.
UNNAMED_RETRY_WAIT = 60
DELETED_ACCOUNT_LOGIN = "ghost"  # the login GitHub shows for a deleted account
BY_NUMBER = re.compile(r"([^/@#\s]+/[^/@#\s]+)#([1-9][0-9]*)")
BY_BRANCH = re.compile(r"([^/@#\s]+/[^/@#\s]+)@(\S+)")


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


@dataclass(frozen=True)
class CommitStatus:
    id: int
    context: str
    state: StatusState
    target_url: str | None

    @classmethod
    def from_json(cls, status: dict) -> "CommitStatus":
        return cls(status["id"], status["context"], StatusState(status["state"]), status["target_url"])


def target(text: str) -> tuple[str, dict]:
    if match := BY_NUMBER.fullmatch(text):
        return match[1], {"number": int(match[2])}
    if match := BY_BRANCH.fullmatch(text):
        return match[1], {"head": match[2]}
    raise argparse.ArgumentTypeError(f"{text!r} is neither owner/repo#number nor owner/repo@branch")


class Refused(Exception):
    """GitHub refused a request over a rate limit and named how long to wait before sending it again."""

    def __init__(self, wait: float, stderr: str) -> None:
        super().__init__(stderr)
        self.wait = wait


def retry_wait(status: int | None, headers: Message, body: bytes) -> float | None:
    """The seconds a request refused over a rate limit waits before it is sent again, or None for any
    other failure (see
    https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api#handle-rate-limit-errors-appropriately,
    checked 2026-10-22)."""
    if (after := headers.get("Retry-After")) is not None:
        return float(after)
    if headers.get("X-RateLimit-Remaining") == "0":
        return float(headers["X-RateLimit-Reset"]) - parsedate_to_datetime(headers["Date"]).timestamp()
    # GitHub refuses with 403 or 429 and a message that names the rate limit.
    if status == HTTPStatus.TOO_MANY_REQUESTS or (status == HTTPStatus.FORBIDDEN and "rate limit" in message(body)):
        return UNNAMED_RETRY_WAIT
    return None


def message(body: bytes) -> str:
    """The message of a GitHub error body in lower case, or an empty text for any other body."""
    try:
        error = json.loads(body)
    except ValueError:
        return ""
    return str(error.get("message", "")).lower() if isinstance(error, dict) else ""


@dataclass(frozen=True)
class Response:
    status: int
    headers: Message
    body: object  # the JSON of the body, None for an empty body


def fetch(path: str, etag: str | None = None) -> Response:
    """Sends one GET request through gh and returns the response, a 304 Not Modified included.

    Raises Refused for a request refused over a rate limit, and CalledProcessError
    for every other failure of gh."""
    conditional = ["-H", f"If-None-Match: {etag}"] if etag else []
    done = subprocess.run(["gh", "api", "--include", *conditional, path], capture_output=True)
    # gh prints the status line, the headers and the body, and fails for every status from 300 on.
    out = io.BytesIO(done.stdout)
    status_line = out.readline().split()
    status = int(status_line[1]) if status_line else None
    headers = http.client.parse_headers(out) if status else Message()
    body = out.read()
    if done.returncode and status != HTTPStatus.NOT_MODIFIED:
        stderr = done.stderr.decode(errors="replace")
        if (wait := retry_wait(status, headers, body)) is not None:
            raise Refused(wait, stderr)
        raise subprocess.CalledProcessError(done.returncode, done.args, done.stdout, stderr)
    return Response(status, headers, json.loads(body) if body.strip() else None)


def has_next_page(headers: Message) -> bool:
    # GitHub names the next page of a list in the Link header, with the relation "next".
    for link in urllib.request.parse_http_list(headers.get("Link", "")):
        params = Message()
        params["Link"] = link
        if params.get_param("rel", header="Link") == "next":
            return True
    return False


class GitHub:
    """Reads the REST API through gh with conditional requests and counts what they cost.

    A request carries the ETag of the last full response to the same path. GitHub answers an
    unchanged resource with 304 Not Modified, which does not count against the rate limit (see
    https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api#use-conditional-requests-if-appropriate,
    checked 2026-10-22), and the response then comes from the copy kept here."""

    def __init__(self, sleep: Callable[[float], None]) -> None:
        self.sleep = sleep
        self.copies: dict[str, Response] = {}
        self.requests = 0  # every request sent
        # The requests answered in full, which count against the rate limit. A request that fails is
        # not counted here, so it is taken for other use of the login.
        self.counted = 0

    def send(self, path: str, etag: str | None = None) -> Response:
        # A refused request waits as long as GitHub names and is sent again, since sending more
        # while refused can get the login banned.
        while True:
            try:
                return fetch(path, etag)
            except Refused as refusal:
                emit(kind="refused", path=path, seconds=refusal.wait)
                self.sleep(refusal.wait)

    def get(self, path: str) -> Response:
        copy = self.copies.get(path)
        self.requests += 1
        response = self.send(path, copy.headers["ETag"] if copy else None)
        if response.status == HTTPStatus.NOT_MODIFIED:
            return copy
        self.counted += 1
        if response.headers["ETag"]:
            self.copies[path] = response
        return response

    def pages(self, path: str, **query: str) -> list:
        pages = []
        for number in itertools.count(1):
            response = self.get(f"{path}?{urlencode({**query, 'per_page': PAGE_SIZE, 'page': number})}")
            pages.append(response.body)
            if not has_next_page(response.headers):
                return pages

    def rate_limit(self) -> "RateLimit":
        # Reading the rate limit does not count against it.
        response = self.send("rate_limit")
        return RateLimit.from_json(response.body, parsedate_to_datetime(response.headers["Date"]).timestamp())


def flat(pages):
    return [item for page in pages for item in page]


@dataclass(frozen=True)
class RateLimit:
    """The REST rate limit of the gh login at one moment, as GitHub reports it."""

    used: int  # requests counted in the current window, from every client of the login
    remaining: int
    reset: int  # the time GitHub restores the limit, in seconds since the epoch
    at: float  # the time of the reading on the clock of GitHub, from the Date header of the response

    @classmethod
    def from_json(cls, limits: dict, at: float) -> "RateLimit":
        core = limits["resources"]["core"]
        return cls(core["used"], core["remaining"], core["reset"], at)


@dataclass(frozen=True)
class Mark:
    """A reading of the rate limit with the requests the watcher had sent and had counted by then."""

    limit: RateLimit
    requests: int
    counted: int


class Pacer:
    """Waits between two rounds of polls by the REST rate limit of the gh login.

    The pace plans every request of the watcher as if it counted against the limit, so it stays even
    through a window while requests answered with 304 leave the limit untouched. Of the requests
    left, the watcher takes the part that matches its part of the use observed in the window, so
    other use of the login keeps a part that grows with that use. The rounds spread the part of the
    watcher until GitHub restores the limit, and when it does not cover a round, the watcher waits
    until then."""

    def __init__(self, github: GitHub, clock: Callable[[], float], sleep: Callable[[float], None]) -> None:
        self.github, self.clock, self.sleep = github, clock, sleep
        # The first reading of the current window, and the last good reading.
        self.window = self.last = self.mark()
        self.rounds = 0  # rounds since the last good reading
        self.outage_start: float | None = None  # the clock at the first failed reading of an outage

    def mark(self) -> Mark:
        return Mark(self.github.rate_limit(), self.github.requests, self.github.counted)

    def wait_after_round(self) -> None:
        self.rounds += 1
        try:
            now = self.mark()
        except subprocess.CalledProcessError as error:
            emit(kind="rate-limit-unreadable", stderr=error.stderr.strip())
            at = self.clock()
            if self.outage_start is None:
                self.outage_start = at
            # Wait as long as the outage has lasted, so its end is noticed at most about as late again.
            self.sleep(at - self.outage_start)
            return
        if now.limit.reset != self.window.limit.reset:
            self.window = now
        wait = self.pause(now)
        self.last, self.rounds, self.outage_start = now, 0, None
        self.sleep(wait)

    def pause(self, now: Mark) -> float:
        limit = now.limit
        left = max(0.0, limit.reset - limit.at)
        sent = now.requests - self.window.requests
        counted = now.counted - self.window.counted
        others = max(0, limit.used - self.window.limit.used - counted)
        # The requests that would be left if every request of the watcher in this window had counted.
        planned_left = limit.remaining - (sent - counted)
        share = planned_left * sent / (sent + others) if others else planned_left
        cost = (now.requests - self.last.requests) / self.rounds
        return left if share <= cost else left * cost / share


def check_login() -> None:
    try:
        subprocess.run(["gh", "auth", "status"], check=True, capture_output=True, text=True)
    except FileNotFoundError:
        sys.exit("watch-prs: gh, the GitHub CLI, is not installed")
    except subprocess.CalledProcessError as error:
        sys.exit(f"watch-prs: gh is not logged in: {error.stderr.strip()}")


def resolve(github: GitHub, repo: str, target: dict) -> int:
    if "number" in target:
        return target["number"]
    try:
        pulls = flat(github.pages(f"repos/{repo}/pulls", state="open"))
    except subprocess.CalledProcessError as error:
        sys.exit(f"watch-prs: cannot list the open pull requests of {repo}: {error.stderr.strip()}")
    # The head ref is only the branch name, so pull requests from different forks can share it.
    numbers = [pr["number"] for pr in pulls if pr["head"]["ref"] == target["head"]]
    if not numbers:
        sys.exit(f"watch-prs: {repo} has no open pull request whose head is {target['head']}")
    if len(numbers) > 1:
        listed = ", ".join(f"{repo}#{number}" for number in numbers)
        sys.exit(f"watch-prs: {repo} has more than one open pull request whose head is {target['head']}: "
                 f"{listed}; name the one to watch by its number")
    return numbers[0]


def author(item: dict) -> str:
    # GitHub returns "user": null for a deleted account.
    user = item["user"]
    return user["login"] if user else DELETED_ACCOUNT_LOGIN


def emit(**event) -> None:
    print(json.dumps(event, ensure_ascii=False), flush=True)


def poll(github: GitHub, repo: str, number: int, seen: set[str]) -> bool:
    pr = github.get(f"repos/{repo}/pulls/{number}").body
    where = f"{repo}#{number}"
    head = pr["head"]["sha"]
    events = []
    for c in flat(github.pages(f"repos/{repo}/issues/{number}/comments")):
        events.append((f"ic{c['id']}", dict(kind="comment", author=author(c), url=c["html_url"],
                                            body=c["body"])))
    for r in flat(github.pages(f"repos/{repo}/pulls/{number}/reviews")):
        if r["state"] == "PENDING":
            continue
        events.append((f"rv{r['id']}", dict(kind="review", state=r["state"], author=author(r),
                                            url=r["html_url"], body=r["body"], commit=r["commit_id"])))
    for c in flat(github.pages(f"repos/{repo}/pulls/{number}/comments")):
        events.append((f"rc{c['id']}", dict(kind="review-comment", author=author(c), url=c["html_url"],
                                            path=c["path"], line=c.get("line"),
                                            in_reply_to=c.get("in_reply_to_id"), body=c["body"],
                                            commit=c["commit_id"])))
    for page in github.pages(f"repos/{repo}/commits/{head}/check-runs"):
        for run in page["check_runs"]:
            if run["status"] == "completed" and run["conclusion"] in FAILED_CONCLUSIONS:
                events.append((f"ck{run['id']}", dict(kind="check-failed", name=run["name"],
                                                      conclusion=run["conclusion"], url=run["html_url"],
                                                      commit=head)))
    for page in github.pages(f"repos/{repo}/commits/{head}/status"):
        for payload in page["statuses"]:
            status = CommitStatus.from_json(payload)
            if status.state.failed:
                events.append((f"st{status.id}", dict(kind="status-failed", name=status.context,
                                                      state=status.state.value, url=status.target_url,
                                                      commit=head)))
    for key, event in events:
        if f"{where}:{key}" not in seen:
            seen.add(f"{where}:{key}")
            emit(pr=where, head=head, **event)
    if pr["state"] == "closed":
        emit(pr=where, kind="merged" if pr["merged"] else "closed")
        return False
    return True


def save(state: Path, seen: set[str]) -> None:
    # Replace the file in one step, so a watch stopped mid-write leaves the previous state whole.
    partial = state.with_name(state.name + ".partial")
    partial.write_text(json.dumps(sorted(seen)))
    partial.replace(state)


def main(clock: Callable[[], float], sleep: Callable[[float], None]) -> None:
    parser = argparse.ArgumentParser(description="Print one JSON line per new event on the given pull requests.")
    parser.add_argument("--state", type=Path, required=True,
                        help="file that keeps the ids of every printed event across restarts")
    parser.add_argument("prs", nargs="+", type=target, metavar="pull-request",
                        help="owner/repo#number, or owner/repo@branch for the open pull request of that branch")
    args = parser.parse_args()

    check_login()
    seen = set(json.loads(args.state.read_text())) if args.state.exists() else set()
    args.state.parent.mkdir(parents=True, exist_ok=True)
    github = GitHub(sleep)
    open_prs = [(repo, resolve(github, repo, target)) for repo, target in args.prs]
    try:
        pacer = Pacer(github, clock, sleep)
    except subprocess.CalledProcessError as error:
        sys.exit(f"watch-prs: cannot read the rate limit of the gh login: {error.stderr.strip()}")
    emit(kind="watching", prs=[f"{r}#{n}" for r, n in open_prs])
    while open_prs:
        still_open = []
        for repo, number in open_prs:
            try:
                if poll(github, repo, number, seen):
                    still_open.append((repo, number))
            except subprocess.CalledProcessError as error:
                emit(pr=f"{repo}#{number}", kind="poll-error", stderr=error.stderr.strip())
                still_open.append((repo, number))
            save(args.state, seen)
        open_prs = still_open
        if open_prs:
            pacer.wait_after_round()
    emit(kind="done")


if __name__ == "__main__":
    main(time.monotonic, time.sleep)

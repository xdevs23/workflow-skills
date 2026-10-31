"""Reads the REST API of GitHub through gh, the GitHub CLI."""

import http.client
import io
import itertools
import json
import subprocess
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass
from email.message import Message
from email.utils import parsedate_to_datetime
from http import HTTPStatus
from typing import TypeVar
from urllib.parse import urlencode

from .events import Refused, emit
from .payloads import RateLimitPayload

# The largest page GitHub serves for most lists, accepted as a limit of GitHub on 2026-10-22 from
# https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api (checked
# 2026-10-22). A list is read up to the page without a next page in its Link header, so a smaller
# page served by GitHub only costs more requests.
PAGE_SIZE = 100
# The wait GitHub asks for after a refusal over a rate limit that names no wait, accepted as a limit
# of GitHub on 2026-10-22 from the page that retry_wait names.
UNNAMED_RETRY_WAIT = 60
# The exit status of gh for a command that needs a login when none is configured, from
# https://cli.github.com/manual/gh_help_exit-codes (checked 2026-10-31).
GH_AUTH_REQUIRED = 4

T = TypeVar("T")


class LoginLostError(Exception):
    """gh has no login accepted by GitHub: none is configured, or GitHub rejected its token.

    After several requests with invalid credentials, GitHub answers every request sent with the
    account with 403 for a while, valid ones included (see
    https://docs.github.com/en/rest/authentication/authenticating-to-the-rest-api#failed-login-limit,
    checked 2026-10-31), so the watcher sends nothing more once the login is lost."""


class RefusedError(Exception):
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

    Raises LoginLostError when gh has no login accepted by GitHub, RefusedError for a request refused
    over a rate limit, and CalledProcessError for every other failure of gh."""
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
        # gh exits with GH_AUTH_REQUIRED without sending the request when no login is configured,
        # and GitHub answers a token it does not accept with 401.
        if done.returncode == GH_AUTH_REQUIRED or status == HTTPStatus.UNAUTHORIZED:
            raise LoginLostError(stderr)
        if (wait := retry_wait(status, headers, body)) is not None:
            raise RefusedError(wait, stderr)
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


def flat(pages: list[list[T]]) -> list[T]:
    return [item for page in pages for item in page]


@dataclass(frozen=True)
class RateLimit:
    """The REST rate limit of the gh login at one moment, as GitHub reports it."""

    used: int  # requests counted in the current window, from every client of the login
    remaining: int
    reset: int  # the time GitHub restores the limit, in seconds since the epoch
    at: float  # the time of the reading on the clock of GitHub, from the Date header of the response

    @classmethod
    def from_json(cls, limits: RateLimitPayload, at: float) -> "RateLimit":
        core = limits["resources"]["core"]
        return cls(core["used"], core["remaining"], core["reset"], at)


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
            except RefusedError as refusal:
                emit(Refused(path, refusal.wait))
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

    def rate_limit(self) -> RateLimit:
        # Reading the rate limit does not count against it.
        response = self.send("rate_limit")
        return RateLimit.from_json(response.body, parsedate_to_datetime(response.headers["Date"]).timestamp())

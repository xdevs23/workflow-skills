"""Paces the rounds of polls by the REST rate limit of the gh login."""

import subprocess
from collections.abc import Callable
from dataclasses import dataclass

from .events import RateLimitUnreadable, emit
from .github import GitHub, RateLimit


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
            emit(RateLimitUnreadable(error.stderr.strip()))
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

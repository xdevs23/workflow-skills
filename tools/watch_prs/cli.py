"""The command line of the watcher and its loop over rounds of polls."""

import argparse
import shutil
import subprocess
import sys
from collections.abc import Callable
from pathlib import Path

from .errors import WatchError
from .event_log import EventLog
from .events import Done, LoginLost, PollFailed, Watching, emit
from .github import GitHub, LoginLostError
from .pacer import Pacer
from .pull_requests import poll
from .targets import PULL_REQUEST_FORMS, Target, parse_target


def main(clock: Callable[[], float], sleep: Callable[[float], None]) -> None:
    parser = argparse.ArgumentParser(
        description="Print one JSON line per new or edited event on the given pull requests.")
    parser.add_argument("--state", type=Path, required=True,
                        help="file that contains the id and a digest of the body of every printed event")
    parser.add_argument("prs", nargs="+", type=parse_target, metavar="pull-request",
                        help=f"{PULL_REQUEST_FORMS}; a branch without an account is a branch of the repository "
                             "itself, and account:branch is a branch in the fork owned by that account")
    args = parser.parse_args()

    try:
        if shutil.which("gh") is None:
            raise WatchError("gh, the GitHub CLI, is not installed. Install it from https://cli.github.com, "
                             "then start the watcher again")
        watch(args.prs, EventLog(args.state), clock, sleep)
    except LoginLostError as lost:
        emit(LoginLost(str(lost).strip()))
        sys.exit(1)
    except WatchError as error:
        sys.exit(f"watch-prs: {error}")


def watch(targets: list[Target], log: EventLog, clock: Callable[[], float], sleep: Callable[[float], None]) -> None:
    github = GitHub(sleep)
    open_prs = [target.resolve(github) for target in targets]
    try:
        pacer = Pacer(github, clock, sleep)
    except subprocess.CalledProcessError as error:
        raise WatchError(f"cannot read the rate limit of the gh login: {error.stderr.strip()}. Run gh api "
                         f"rate_limit to see the failure, then start the watcher again once it succeeds") from error
    emit(Watching(tuple(map(str, open_prs))))
    while open_prs:
        still_open = []
        for pr in open_prs:
            try:
                if poll(github, pr, log):
                    still_open.append(pr)
            except subprocess.CalledProcessError as error:
                emit(PollFailed(str(pr), error.stderr.strip()))
                still_open.append(pr)
            log.save()
        open_prs = still_open
        if open_prs:
            pacer.wait_after_round()
    emit(Done())

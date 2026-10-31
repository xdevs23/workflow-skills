"""The pull requests named on the command line, and the lookup of a pull request by its branch."""

import argparse
import re
import subprocess
from dataclasses import dataclass

from .errors import WatchError
from .github import GitHub, flat
from .payloads import PullRequestSummaryPayload

BY_NUMBER = re.compile(r"(?P<repo>[^/@#\s]+/[^/@#\s]+)#(?P<number>[1-9][0-9]*)")
# A git branch name cannot contain a colon (see https://git-scm.com/docs/git-check-ref-format,
# checked 2026-10-31), so the first colon after @ separates the account from the branch.
BY_BRANCH = re.compile(
    r"(?P<repo>(?P<owner>[^/@#\s]+)/[^/@#\s]+)@(?:(?P<account>[^/@#:\s]+):)?(?P<branch>[^:\s]+)")
PULL_REQUEST_FORMS = "owner/repo#number, owner/repo@branch or owner/repo@account:branch"


@dataclass(frozen=True)
class ByNumber:
    repo: str
    number: int

    def __str__(self) -> str:
        return f"{self.repo}#{self.number}"

    @classmethod
    def from_json(cls, repo: str, pull: PullRequestSummaryPayload) -> "ByNumber":
        return cls(repo, pull["number"])

    def resolve(self, github: GitHub) -> "ByNumber":
        return self


@dataclass(frozen=True)
class ByBranch:
    repo: str
    account: str
    branch: str

    @property
    def label(self) -> str:
        """The head as account:branch, the form GitHub expects for the head parameter when it lists
        pull requests (see https://docs.github.com/en/rest/pulls/pulls#list-pull-requests, checked
        2026-10-31)."""
        return f"{self.account}:{self.branch}"

    def resolve(self, github: GitHub) -> ByNumber:
        try:
            # Seen on 2026-10-31: GET repos/cli/cli/pulls?head=trunk, a head without the account,
            # returned the unfiltered first page of open pull requests.
            pulls: list[PullRequestSummaryPayload] = flat(
                github.pages(f"repos/{self.repo}/pulls", state="open", head=self.label))
        except subprocess.CalledProcessError as error:
            raise WatchError(f"cannot list the open pull requests of {self.repo} whose head is {self.label}: "
                             f"{error.stderr.strip()}. Run gh api repos/{self.repo}/pulls to check that gh "
                             f"can read them, then start the watcher again") from error
        found = [ByNumber.from_json(self.repo, pull) for pull in pulls]
        if not found:
            raise WatchError(f"{self.repo} has no open pull request whose head is {self.label}. Check the "
                             f"account and the branch, or name the pull request as {PULL_REQUEST_FORMS}")
        # GitHub allows one open pull request per head and base branch, so a head can have several.
        if len(found) > 1:
            listed = ", ".join(map(str, found))
            raise WatchError(f"{self.repo} has more than one open pull request whose head is {self.label}: "
                             f"{listed}. Name the one to watch by its number")
        return found[0]


Target = ByNumber | ByBranch


def parse_target(text: str) -> Target:
    if match := BY_NUMBER.fullmatch(text):
        return ByNumber(match["repo"], int(match["number"]))
    if match := BY_BRANCH.fullmatch(text):
        return ByBranch(match["repo"], match["account"] or match["owner"], match["branch"])
    raise argparse.ArgumentTypeError(f"{text!r} names no pull request. Name it as {PULL_REQUEST_FORMS}")

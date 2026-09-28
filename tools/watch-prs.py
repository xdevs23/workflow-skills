#!/usr/bin/env python3
"""Watch pull requests with the GitHub CLI and print one JSON line per new event.

Run as `watch-prs.py --state <file> [--interval <seconds>] <pull request>...`. A pull request is
named as `owner/repo#number`, or as `owner/repo@branch` for the open pull request whose head is
that branch.

Events: every issue comment, review other than a pending one, review thread comment and failed
check run on the head commit of each pull request, and the pull request closing or merging. The
ids of every printed event are kept in the state file, so a restarted watch prints only what is
new. The tool exits when every pull request is closed or merged.
"""

import argparse
import json
import re
import subprocess
import sys
import time
from pathlib import Path

FAILED = {"failure", "timed_out", "cancelled", "action_required", "startup_failure"}
BY_NUMBER = re.compile(r"([^/@#\s]+/[^/@#\s]+)#([1-9][0-9]*)")
BY_BRANCH = re.compile(r"([^/@#\s]+/[^/@#\s]+)@(\S+)")


def target(text: str) -> tuple[str, dict]:
    if match := BY_NUMBER.fullmatch(text):
        return match[1], {"number": int(match[2])}
    if match := BY_BRANCH.fullmatch(text):
        return match[1], {"head": match[2]}
    raise argparse.ArgumentTypeError(f"{text!r} is neither owner/repo#number nor owner/repo@branch")


def seconds(text: str) -> float:
    value = float(text)
    # The negated comparison also refuses nan, which compares false with everything.
    if not 0 <= value < float("inf"):
        raise argparse.ArgumentTypeError(f"{text!r} is not a finite number of seconds of at least 0")
    return value


def gh(*args: str):
    out = subprocess.run(["gh", *args], check=True, capture_output=True, text=True).stdout
    return json.loads(out) if out.strip() else None


def api(path: str):
    return gh("api", "--paginate", "--slurp", path)


def flat(pages):
    return [item for page in pages for item in page]


def check_login() -> None:
    try:
        subprocess.run(["gh", "auth", "status"], check=True, capture_output=True, text=True)
    except FileNotFoundError:
        sys.exit("watch-prs: gh, the GitHub CLI, is not installed")
    except subprocess.CalledProcessError as error:
        sys.exit(f"watch-prs: gh is not logged in: {error.stderr.strip()}")


def resolve(repo: str, target: dict) -> int:
    if "number" in target:
        return target["number"]
    try:
        pulls = flat(api(f"repos/{repo}/pulls?state=open&per_page=100"))
    except subprocess.CalledProcessError as error:
        sys.exit(f"watch-prs: cannot list the open pull requests of {repo}: {error.stderr.strip()}")
    for pr in pulls:
        if pr["head"]["ref"] == target["head"]:
            return pr["number"]
    sys.exit(f"watch-prs: {repo} has no open pull request whose head is {target['head']}")


def emit(**event) -> None:
    print(json.dumps(event, ensure_ascii=False), flush=True)


def poll(repo: str, number: int, seen: set[str]) -> bool:
    (pr,) = api(f"repos/{repo}/pulls/{number}")
    where = f"{repo}#{number}"
    head = pr["head"]["sha"]
    events = []
    for c in flat(api(f"repos/{repo}/issues/{number}/comments")):
        events.append((f"ic{c['id']}", dict(kind="comment", author=c["user"]["login"], url=c["html_url"],
                                            body=c["body"])))
    for r in flat(api(f"repos/{repo}/pulls/{number}/reviews")):
        if r["state"] == "PENDING":
            continue
        events.append((f"rv{r['id']}", dict(kind="review", state=r["state"], author=r["user"]["login"],
                                            url=r["html_url"], body=r["body"], commit=r["commit_id"])))
    for c in flat(api(f"repos/{repo}/pulls/{number}/comments")):
        events.append((f"rc{c['id']}", dict(kind="review-comment", author=c["user"]["login"], url=c["html_url"],
                                            path=c["path"], line=c.get("line"),
                                            in_reply_to=c.get("in_reply_to_id"), body=c["body"],
                                            commit=c["commit_id"])))
    for page in api(f"repos/{repo}/commits/{head}/check-runs"):
        for run in page["check_runs"]:
            if run["status"] == "completed" and run["conclusion"] in FAILED:
                events.append((f"ck{run['id']}", dict(kind="check-failed", name=run["name"],
                                                      conclusion=run["conclusion"], url=run["html_url"],
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


def main() -> None:
    parser = argparse.ArgumentParser(description="Print one JSON line per new event on the given pull requests.")
    parser.add_argument("--state", type=Path, required=True,
                        help="file that keeps the ids of every printed event across restarts")
    parser.add_argument("--interval", type=seconds, default=60, help="seconds between polls, 60 when not given")
    parser.add_argument("prs", nargs="+", type=target, metavar="pull-request",
                        help="owner/repo#number, or owner/repo@branch for the open pull request of that branch")
    args = parser.parse_args()

    check_login()
    seen = set(json.loads(args.state.read_text())) if args.state.exists() else set()
    args.state.parent.mkdir(parents=True, exist_ok=True)
    open_prs = [(repo, resolve(repo, target)) for repo, target in args.prs]
    emit(kind="watching", prs=[f"{r}#{n}" for r, n in open_prs])
    while open_prs:
        still_open = []
        for repo, number in open_prs:
            try:
                if poll(repo, number, seen):
                    still_open.append((repo, number))
            except subprocess.CalledProcessError as error:
                emit(pr=f"{repo}#{number}", kind="poll-error", stderr=error.stderr.strip())
                still_open.append((repo, number))
            save(args.state, seen)
        open_prs = still_open
        if open_prs:
            time.sleep(args.interval)
    emit(kind="done")


if __name__ == "__main__":
    main()

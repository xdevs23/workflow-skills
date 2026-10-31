#!/usr/bin/env python3
"""Watch pull requests with the GitHub CLI and print one JSON line per new or edited event.

Run as `watch-prs.py --state <file> <pull request>...`. A pull request is named as
`owner/repo#number`, or as `owner/repo@branch` for the open pull request whose head is that branch.
A branch in a fork is named with the account that owns the fork, as `owner/repo@account:branch`.

The watcher prints every issue comment, review other than a pending one, review thread comment,
failed check run and failed commit status on the head commit of each pull request, a merge conflict
between its head and its base branch, and the pull request closing or merging. A comment or review
whose body changed is printed again with the field edited set to true. The state file contains the
id of every printed event with a digest of its body, so a restarted watch prints only what is new or
edited. The tool exits when every pull request is closed or merged, and with a login-lost event and
status 1 when gh has no login accepted by GitHub.

A request carries the ETag of the last full response to the same path, so a page that did not change
costs nothing against the REST rate limit of the gh login. Between two rounds of polls the watcher
waits as the class Pacer describes.
"""

import time

from watch_prs.cli import main

if __name__ == "__main__":
    main(time.monotonic, time.sleep)

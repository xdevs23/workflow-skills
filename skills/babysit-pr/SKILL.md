---
name: babysit-pr
description: Whenever a PR is created or needs watching
---

## Start and watch

- Watch pull request with `watch-prs`, pull request watcher shipped with this plugin. Watcher is
  Python program in tools directory of plugin. Found in this repository or in directory of
  installed plugin under plugin cache
- Run it with `python3`. Pass state file with `--state`. Name pull request as last argument:
  `owner/repo#number`, or `owner/repo@branch` for open pull request whose head is that branch in
  repository itself. For branch in fork, name account that owns fork before branch:
  `owner/repo@account:branch`
- Put state file in project cache defined by `workflow-skills:local-cache`
- Run watcher through Monitor tool where harness has it, since every line printed by watcher is one
  event. Otherwise run it in shell where `gh` is logged in. Read output line by line
- Handle every event not handled yet. Watcher prints each event as one JSON line.
  First poll prints every comment, review and reply in review thread already on pull request. Also
  every failed check run and failed commit status on head commit of pull request, and merge conflict
  between head commit and base branch
- Expect watcher to poll again after first poll. Expect it to print each new comment, review or
  reply in review thread, each check run or commit status that fails on head commit, merge conflict
  between head commit and base branch, and pull request being closed or merged
- Expect unchanged page to cost nothing against GitHub rate limit of `gh` login, since watcher asks
  for it again with ETag of its last answer. Watcher plans its rounds as if every request counted.
  Of requests left, it sets aside the part that matches its share of the use of the login seen
  since GitHub last restored limit. Spreads that part until GitHub restores limit again. More other
  use of login makes it poll more rarely
- Expect restarted watcher to print only new and edited events, since state file contains id of
  every event printed before and digest of its body. Event printed just before watcher stopped may
  print again after restart
- Post comment only when it adds something of value
- Do not act on your own replies. Recognize them by mandatory prefix at their start
- When watcher stops without error exit while pull request still open, start it again
- When watcher exits with error, such as `login-lost`, branch without open pull request or branch
  with more than one: start it again only once cause named in error message or event fixed
- Expect `login-lost` event as last line when `gh` has no login accepted by GitHub: none configured,
  or token rejected
- Expect watcher to exit after `login-lost` without sending further requests, since repeated
  requests with rejected token make GitHub refuse every request from account for a while
- Tell user that `gh` login lost and that `gh auth login` restores it
- When pull request closed or merged, stop polling

## Comments and reviews

- Act on every comment and review without waiting to be asked. Bots and people alike, whatever
  commit it was made on
- Expect edited comment, review or reply in review thread to print again with `edited` field set to
  `true`, new body and same `url`. Act on new body
- Check reported problem against code before you edit anything
- Make change needed by comment, or decline finding disproved by check
- Reply in both cases by `workflow-skills:pr-comment-replies`
- After you push fix for comment, update description and pictures by section "Opening and updating"
  of `workflow-skills:pull-request`

## Failed checks

- Tell failure caused by repository apart from failure of infrastructure
- Fix failure caused by repository
- After you push fix for failure, update description and pictures by section "Opening and updating"
  of `workflow-skills:pull-request`
- Handle `status-failed` event like `check-failed` event. It reports commit status in failure or
  error state, posted by CI service through commit status API in place of check runs
- Skip `check-failed` or `status-failed` event for commit older than newest push

## Merge conflicts

- Resolve conflict reported by `conflict` event against base branch named in its `base` field. Push
  result. GitHub does not run workflow triggered by `pull_request` on pull request with conflict,
  so those checks start only once conflict resolved
- Expect `conflict` event once per head commit. Push that resolves conflict moves head

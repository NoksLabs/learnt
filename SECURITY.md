# Security

## Reporting a vulnerability

Report it privately through GitHub: open the repository's **Security** tab and
choose **Report a vulnerability**. Please do not open a public issue.

Include what you found, how to reproduce it, and which agent and Node.js
version you used. You will get a reply within a week.

## Supported versions

Only the latest commit on `main` gets fixes. Update with `git pull`, then run
`learnt install` again for Codex, which keeps its own copy of the skills.

Learnt needs Node.js `^24.22.1 || >=26.12.1`; older releases have known
vulnerabilities, including CVE-2026-111497.

## What Learnt touches

Learnt reads and writes only its notes folder (`.learnt/`) and the agent
configuration files its installer names. The installer backs up anything it
replaces to `~/.learnt-install-backups/`. The README lists the safety rules.

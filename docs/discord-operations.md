# Discord Operations Bot

This repository can be used as a safe Discord operations bot for community coordination, deployment awareness, and read-only status reporting.

## Current command plan

- `!help` - list available commands.
- `!connect-gitlab` - provide the configured GitLab OAuth link.
- `!gas status` - display configured network-watch information.
- `!bridge status` - display Discord bridge readiness.
- `!skygrid status` - display the configured SKYGRID status URL.

## Safety rules

- Do not commit `.env`.
- Do not place bot tokens in source code.
- Do not place wallet secrets, seed phrases, recovery phrases, private keys, or signing keys in Discord, GitHub, logs, screenshots, or tickets.
- Use public watch addresses only.
- Keep transaction signing outside the Discord bot.
- Prefer GitHub Actions, Vercel, AWS, or another secret manager for runtime secrets.

## Recommended Discord server layout

### SKYGRID Command Center

- `#ops-status`
- `#deploy-alerts`
- `#skygrid-bridge`
- `#incident-log`

### Web3 Lab

- `#gas-watch`
- `#bridge-testing`
- `#bot-commands`
- `#research-notes`

## Next integration step

Connect read-only HTTP status sources only:

- SKYGRID Emergency Data On-Ramp health endpoint.
- Public gas estimate provider.
- Public explorer balance endpoint for watch-only addresses.

Any live transaction flow should be designed separately with explicit review and secure signing boundaries.

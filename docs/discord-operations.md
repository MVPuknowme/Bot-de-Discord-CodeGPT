# Discord Operations Bot

This repository can be used as a safe Discord operations bot for community coordination, deployment awareness, and read-only status reporting.

## Current commands

- `!agent <request>` or a direct bot mention - run the guarded OpenAI agent.
- `!agent status` - report configuration without an OpenAI call.
- `!token <mint> [owner-wallet]` - validate public Solana mint and optional holding facts.
- `!lease <console-count> [requirements]` - create a human-review intake draft.
- `!help` - list available commands.
- `!connect-gitlab` - provide the configured GitLab OAuth link.
- `!gas status` - display configured network-watch information.
- `!bridge status` - display Discord bridge readiness.
- `!skygrid status` - display the configured SKYGRID status URL.

## Safety rules

- Do not commit `.env`.
- Do not place bot tokens in source code.
- Do not place wallet secrets, seed phrases, recovery phrases, private keys, or signing keys in Discord, GitHub, logs, screenshots, or tickets.
- Do not place Discord bot tokens or OpenAI API keys in Discord, GitHub, logs, screenshots, or tickets.
- Use public watch addresses only.
- Keep transaction signing outside the Discord bot.
- Treat mint validation as an account-structure check, never a legitimacy, safety, price, or endorsement determination.
- Keep validator identity keys, vote-account keys, withdraw authority, and signing material with the operator.
- Lease requests are intake drafts only. A human must approve identity, availability, pricing, terms, compliance, and any activation.
- Prefer GitHub Actions, Vercel, AWS, or another secret manager for runtime secrets.

## Agent request boundary

The AI path runs only for the `!agent` prefix or a direct mention. It applies an input-length limit, per-user cooldown, credential-pattern rejection, response truncation, and disabled Discord mention parsing. Optional `DISCORD_ALLOWED_GUILD_IDS` and `DISCORD_AGENT_CHANNEL_IDS` allow the same bot installation to be limited across multiple servers and channels.

The deterministic `!token` command uses `getAccountInfo` with `jsonParsed` data, verifies ownership by either supported Token Program, requires a parsed and initialized mint account, and optionally calls `getTokenAccountsByOwner` for one public wallet. RPC errors fail closed.

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

## Live integration checklist

- Enable Discord Server Members and Message Content privileged intents.
- Install the bot separately into each approved server through the Discord application OAuth2 URL.
- Configure `BOT_TOKEN`, `OPENAI_API_KEY`, `SOLANA_RPC_URL`, and any guild/channel allowlists in the runtime secret store.
- Run `npm test` and `npm run agent:smoke` before deployment.
- Confirm `!agent status`, `!token`, and a lease-intake draft in one test channel before broad rollout.

Connect any additional HTTP sources as read-only integrations:

- SKYGRID Emergency Data On-Ramp health endpoint.
- Public gas estimate provider.
- Public explorer balance endpoint for watch-only addresses.

Any live transaction flow should be designed separately with explicit review and secure signing boundaries.

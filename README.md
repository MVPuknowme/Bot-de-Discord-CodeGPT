# Discord Solana Operations Agent

Node 22 Discord bot with welcome images, existing read-only operations commands, and a guarded OpenAI Agents SDK layer for Solana game-token validation and validator console lease intake.

## What the agent can do

- Respond only to `!agent <request>` or a direct bot mention.
- Read public Solana RPC data for original SPL Token and Token-2022 mint accounts.
- Optionally total a mint held by one public owner wallet.
- Create a non-binding validator console lease intake draft for human review.
- Run in every installed guild, or in configured guild/channel allowlists.

The bot cannot sign transactions, transfer or stake assets, receive wallet or validator keys, check lease availability, quote pricing, request payment, form a contract, reserve hardware, or activate a validator. A confirmed mint account is not proof of legitimacy, safety, value, endorsement, or exchange support.

## Local setup

1. Install Node.js 22 and run `npm ci`.
2. Copy `.env.example` to `.env`.
3. Set `BOT_TOKEN` and `OPENAI_API_KEY`.
4. Optionally set `DISCORD_ALLOWED_GUILD_IDS` to the comma-separated IDs of your 10 servers and `DISCORD_AGENT_CHANNEL_IDS` to approved bot channels.
5. Run `npm test`, then `npm start`.

The default model is `gpt-5.6-luna`. The default read-only RPC endpoint is Solana mainnet-beta; set `SOLANA_RPC_URL` and `SOLANA_CLUSTER` for another cluster or provider. Keep all secrets in the deployment environment or a secret manager, never in Discord or Git.

## Discord application settings

In the Discord Developer Portal, enable the bot's **Server Members Intent** for welcome messages and **Message Content Intent** for prefixed/mention commands. Install the application with the `bot` scope and only the permissions it needs: View Channels, Send Messages, Read Message History, Attach Files, and Embed Links.

The bot does not automatically join servers. Use the application's Discord OAuth2 install URL for each approved server, and keep the optional guild allowlist aligned with those installations.

## Commands

- `!agent <request>` or mention the bot — guarded natural-language agent.
- `!agent status` — readiness without an OpenAI API call.
- `!token <mint-address> [public-owner-wallet]` — deterministic public RPC validation.
- `!lease <console-count> [requirements]` — intake draft; no offer or reservation.
- `!connect-gitlab` — configured GitLab OAuth link.
- `!help`
- `!gas status`
- `!bridge status`
- `!skygrid status`

Example:

```text
!token EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
!agent Check that mint and explain only the on-chain facts.
!agent Draft intake for 4 Solana mainnet validator consoles for Example Exchange, monthly, US region, 24/7 alerts.
```

## Validation

Run the deterministic suite:

```bash
npm test
```

Run an offline Agents SDK tool-orchestration smoke test with a scripted model and mocked Solana RPC response:

```bash
npm run agent:smoke
```

The offline smoke needs no credentials and contacts neither OpenAI nor a live Solana RPC. To additionally call the configured OpenAI model while keeping Solana RPC mocked, run `npm run agent:smoke:live`; that command requires `OPENAI_API_KEY` and available API credit, but no Discord token.

## GitLab connection

Configure `GITLAB_CLIENT_ID` and `GITLAB_REDIRECT_URI`, optionally set `GITLAB_BASE_URL`, then use `!connect-gitlab`.

## Operations and safety

See [docs/discord-operations.md](docs/discord-operations.md) before connecting live infrastructure. Use public watch addresses only, leave all signing outside Discord, and require a human to approve any commercial or validator operation.

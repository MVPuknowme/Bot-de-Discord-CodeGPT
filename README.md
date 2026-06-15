# Discord Bot CodeGPT Operations Bot

Discord welcome bot with GitLab connection helper and safe read-only operations scaffolding.

## GitLab connection

- Configure `GITLAB_CLIENT_ID` and `GITLAB_REDIRECT_URI`.
- Optionally configure `GITLAB_BASE_URL`.
- Use `!connect-gitlab` in a server channel to get the OAuth link.

## Bot configuration

- Copy `.env.example` to `.env` locally.
- Set `BOT_TOKEN` to the bot token for your Discord application.
- Set `WELCOME_CHANNEL_ID` to the channel that should receive welcome messages.
- Set `DISCORD_INVITE_URL` if the invite changes.

## Operations configuration

- `GAS_NETWORK` controls the network label displayed by the bot.
- `PUBLIC_TREASURY_ADDRESS` is for a public watch address only.
- `SKYGRID_STATUS_URL` points to the SKYGRID Emergency Data On-Ramp status endpoint.

## Commands

- `!connect-gitlab`
- `!help`
- `!gas status`
- `!bridge status`
- `!skygrid status`

## Weekly email workflow

The GitHub Actions workflow in `.github/workflows/weekly-email.yml` runs once a week on Mondays at 09:00 UTC.

Configure the SMTP and recipient secrets: `SMTP_SERVER`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `WEEKLY_EMAIL_TO`, and `WEEKLY_EMAIL_FROM`.

## Safety

See `docs/discord-operations.md` before connecting live infrastructure or funding workflows.

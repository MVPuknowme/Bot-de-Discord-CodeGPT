Change discord token <3

## GitLab connection
- Configure `GITLAB_CLIENT_ID` and `GITLAB_REDIRECT_URI` (optionally `GITLAB_BASE_URL`).
- Use `!connect-gitlab` in a server channel to get the OAuth link.

## Bot configuration
- Set `BOT_TOKEN` to the bot token for your Discord application.
- Set `WELCOME_CHANNEL_ID` to the channel that should receive welcome messages.

## Discord server
- https://discord.gg/YJ5B2YRRP

## Weekly email workflow
- The GitHub Actions workflow in `.github/workflows/weekly-email.yml` runs once a week (Mondays at 09:00 UTC).
- Configure the SMTP and recipient secrets: `SMTP_SERVER`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `WEEKLY_EMAIL_TO`, and `WEEKLY_EMAIL_FROM`.

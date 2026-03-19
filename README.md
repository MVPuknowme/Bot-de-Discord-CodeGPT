Change discord token <3
env:
  DISCORD_BOT_TOKEN: ${{ secrets.DISCORD_BOT_TOKEN }}

## Weekly email workflow
The `Weekly White Rabbit Email` GitHub Actions workflow runs every Monday at 09:00 UTC to
generate token metadata and email it as attachments. Configure the following repository
secrets for the workflow to send messages:

- `EMAIL_SERVER_ADDRESS`
- `EMAIL_SERVER_PORT`
- `EMAIL_USERNAME`
- `EMAIL_PASSWORD`
- `EMAIL_TO`
- `EMAIL_FROM`

You can also run the workflow manually via **Actions → Weekly White Rabbit Email**.

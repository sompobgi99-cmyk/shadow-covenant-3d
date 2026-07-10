# Shadow Post Admin

The game fetches `/api/mailbox` with `cache: no-store` whenever the title screen
loads and whenever the mailbox opens. New messages therefore do not require a
game build or version bump.

## One-time Netlify setup

1. Open the Netlify site dashboard.
2. Go to **Site configuration > Environment variables**.
3. Add `MAILBOX_ADMIN_SECRET` with a long random value.
4. Trigger one deploy so the function receives the new environment variable.

Do not commit the secret or place it in client JavaScript.

## Send mail

Open:

`https://shadow-covenant-3d.netlify.app/mail-admin.html`

Enter `MAILBOX_ADMIN_SECRET`, compose the Thai and English message, select
whether it includes Soul Coins, and send it. The secret is used for the request
only and is not saved by the page.

Message IDs must be unique. Leaving the field blank generates an ID from the
current timestamp. Reusing an ID updates that message instead of creating a new
claimable reward.

## Delivery behavior

- Published messages appear without a deploy or game version change.
- `publishedAt` can schedule a future message.
- `expiresAt` hides a message after the selected time.
- Google users sync read and claimed IDs across devices.
- Guest claims remain on that browser profile.
- A reward can be claimed once per message ID.
- Disabling a message hides it but does not erase claim history.

# ChannelLinker — Bot specification

**Archetype:** custom

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

Telegram bot that on-demand gathers and shares links to all channels a user manages, sending the list to the user's DM and optionally to a selected channel. Designed for multi-channel admins needing quick consolidated access to their channel links.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- Telegram channel admins
- Multi-channel content creators
- Community managers

## Success criteria

- User receives accurate channel list in DM
- User can select and post list to target channel
- Error states show clear remediation steps

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open the main menu
- **/list_channels** (command, actor: user, command: /list_channels) — Initiate channel list request flow
- **Share my channels** (button, actor: user, callback: list_channels:start) — Initiate channel list request flow via button

## Flows

### list_channels_flow
_Trigger:_ /list_channels or button

1. Request list command received
2. Prompt for posting target selection
3. Show channel selection if needed
4. Display preview for confirmation
5. Send to selected destinations on confirmation

_Data touched:_ User, Managed Channel, Request

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **User** _(retention: session)_ — Telegram account requesting the list
  - fields: user_id, last_chosen_channel_id, request_timestamp
- **Managed Channel** _(retention: session)_ — Channel objects with title, username/link, role
  - fields: title, username, link, role
- **Request** _(retention: session)_ — On-demand action tying user to output channel choice
  - fields: posting_target, selected_channel_id

## Integrations

- **Telegram** (required) — Bot API messaging and channel access
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Configure default posting target (DM only, channel only, both)
- Set channel selection limit (default 10)
- Adjust channel list cache TTL (default 1 hour)

## Notifications

- Channel list successfully sent to selected destinations
- Error notifications with remediation steps for posting failures

## Permissions & privacy

- Only list channels the user is admin of
- No long-term storage of channel lists without user opt-in
- Minimal data retention (session-based)

## Edge cases

- User has no channels
- User has more than 10 channels
- Bot lacks permissions to post to selected channel
- Channel link is private and requires invite

## Required tests

- End-to-end test of list generation and posting to both DM and selected channel
- Test error handling for permission failures
- Test channel selection UI with 0, 1, and 15+ channels

## Assumptions

- Default posting target is both DM and selected channel
- Channel list cache is 1 hour
- User must be admin of channels for bot to gather links

# Changelog

All notable changes to StickerSentinel will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025

### Added
- Initial release of StickerSentinel
- Detection of forwarded messages containing external stickers via `messageSnapshots`
- Automatic deletion of messages with unauthorized external stickers
- Permission validation for "Use External Stickers" capability
- Detailed logging using Discord Components V2 cards
- Configurable alert mentions for moderator notifications
- Support for both channel and thread log destinations
- Comprehensive sticker metadata fetching and caching
- Graceful error handling for deleted/unknown stickers
- Environment-based configuration via `.env` file
- Multi-guild support with single bot instance
- Detailed violation reports including:
  - Violator information (username, ID, avatar)
  - Message and channel links
  - Deletion status
  - Permission check results
  - Resolved and failed sticker details
- Thread auto-join capability for log channels
- Protection against sticker permission bypass exploit

### Security
- Bot validates all environment variables on startup
- Sensitive tokens stored in `.env` (not committed to version control)
- Alert mention validation to prevent spam/injection
- Permission checks before message deletion

### Dependencies
- discord.js ^14.24.2
- dotenv ^17.2.3
- @discordjs/builders ^1.13.0
- Node.js 22 LTS or newer

## [Unreleased]

### Planned
- Add configuration option to whitelist specific guilds/users
- Implement cooldown system to prevent log spam from repeated violations
- Add statistics tracking (total violations, per-user counts, etc.)
- Support for custom log message templates
- Webhook support as alternative to bot posting
- Database integration for persistent logging and analytics
- Command system for moderator controls
- Multi-language support for log messages

---

## Version History

- **1.0.0** - Initial stable release with core sticker detection and moderation features
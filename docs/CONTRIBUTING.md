# Contributing to StickerSentinel

Thank you for your interest in contributing to StickerSentinel! This document provides guidelines and information for developers who want to contribute to the project.

## Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/yourusername/jasper_stickerclankers_detector.git
   cd jasper_stickerclankers_detector
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   - Copy `.env.example` to `.env`
   - Fill in your test bot token and a test server's log channel ID
   - Use a dedicated test Discord server for development

4. **Run the bot in development mode**
   ```bash
   npm start
   ```

## Project Structure

```
jasper_stickerclankers_detector/
├── main.js              # Main bot application with all logic
├── package.json         # Project dependencies and metadata
├── .env                 # Environment variables (not committed)
├── .env.example         # Template for environment variables
├── .gitignore          # Git ignore patterns
├── README.md           # User-facing documentation
└── docs/               # Documentation folder
    ├── QUICKSTART.md   # Quick start guide
    ├── DEPLOYMENT.md   # Deployment instructions
    ├── CONTRIBUTING.md # This file
    └── CHANGELOG.md    # Version history
```

## Code Architecture

The `main.js` file is organized into the following sections:

### 1. Configuration & Validation
- `config` object: Frozen configuration from environment variables
- `validateConfig()`: Ensures required variables are present before startup

### 2. Client Initialization
- Discord.js client setup with required intents and partials
- Intents: Guilds, GuildMessages, MessageContent, GuildExpressions, GuildMembers, GuildModeration

### 3. Event Handlers
- `ClientReady`: Logs bot startup information
- `MessageCreate`: Main event handler for detecting sticker violations

### 4. Core Logic Functions
- `extractSnapshotStickerIds()`: Extracts sticker IDs from message snapshots
- `fetchStickerDetails()`: Fetches sticker metadata from Discord API
- `processStickerMessage()`: Determines if a message contains unauthorized stickers
- `resolveExternalStickerPermission()`: Checks user permissions
- `handleForeignSticker()`: Deletes violating messages and logs incidents

### 5. Logging Functions
- `ensureLogChannel()`: Validates log channel accessibility
- `logStickerRemoval()`: Posts violation reports using Components V2
- `buildLogContainer()`: Constructs the embed card with all details
- `buildStickerSection()`: Formats individual sticker information
- `buildUnknownStickerSection()`: Formats failed sticker fetches

### 6. Utility Functions
- `formatStickerDetails()`: Formats sticker metadata for display
- `describeStickerType()`: Converts sticker type enum to readable string
- `buildReasonMessage()`: Generates human-readable violation reasons

## Development Guidelines

### Code Style
- Use tabs for indentation (project standard)
- Use descriptive variable and function names
- Add JSDoc comments for functions with complex logic
- Use `const` by default, `let` only when reassignment is needed
- Use template literals for string interpolation

### Error Handling
- All async operations should be wrapped in try-catch blocks
- Log errors with descriptive context using console.error
- Gracefully handle Discord API errors (rate limits, missing permissions, etc.)
- Never let the bot crash from a single message processing error

### Testing Checklist
Before submitting a pull request, verify:

- [ ] Bot starts successfully with valid `.env` configuration
- [ ] Bot correctly identifies forwarded messages with external stickers
- [ ] Bot respects users with "Use External Stickers" permission
- [ ] Bot successfully deletes violating messages
- [ ] Bot posts detailed logs to the configured channel
- [ ] Bot handles thread channels correctly (auto-joins if needed)
- [ ] Bot handles API errors gracefully (deleted stickers, rate limits, etc.)
- [ ] No console errors during normal operation
- [ ] Code follows existing style and patterns

## Feature Development

### Adding New Detection Methods
If Discord introduces new ways to forward stickers or if new exploit methods emerge:

1. Update the `MessageCreate` event handler to detect the new pattern
2. Extract sticker references using a new extraction function
3. Reuse existing `fetchStickerDetails()` and `processStickerMessage()` logic
4. Update documentation to reflect the new detection method

### Enhancing Log Output
To add new information to violation logs:

1. Modify `buildLogContainer()` to include new sections
2. Use existing Discord.js Components V2 builders (SectionBuilder, TextDisplayBuilder, etc.)
3. Ensure the layout remains readable and not too verbose
4. Test with various scenarios (long usernames, multiple stickers, etc.)

### Adding Configuration Options
To add new environment variables:

1. Update `config` object in main.js
2. Add validation in `validateConfig()` if the variable is required
3. Document the new variable in README.md
4. Update `.env.example` with the new variable and example value

## Debugging Tips

### Enable Verbose Logging
Add temporary debug logs to trace execution:
```javascript
console.log('[DEBUG] Snapshot data:', JSON.stringify(snapshot, null, 2));
```

### Test with Specific Messages
Use Discord's developer mode to:
- Copy message IDs
- Copy channel IDs
- Copy user IDs
- Inspect message payloads

### Common Issues
- **Sticker fetch fails**: May be deleted, from DM, or API transient error
- **Message not deleted**: Check bot role hierarchy and permissions
- **Log not posted**: Verify channel ID and bot can access it
- **Permission check fails**: User may have left server or role was removed

## Submitting Changes

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow the code style guidelines
   - Test thoroughly in a development server
   3. Update documentation in `docs/` folder if needed

3. **Commit with descriptive messages**
   ```bash
   git commit -m "Add: Feature description"
   git commit -m "Fix: Bug description"
   git commit -m "Docs: Documentation update"
   ```

4. **Push and create a pull request**
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Describe your changes**
   - Explain what problem you're solving
   - List any breaking changes
   - Include screenshots for UI/logging changes

## Questions?

If you have questions about contributing, feel free to:
- Open an issue for discussion
- Review existing code and comments
- Check Discord.js documentation for API details
- Review other documentation files in the `docs/` folder

## License

By contributing to StickerSentinel, you agree that your contributions will be licensed under the ISC License.
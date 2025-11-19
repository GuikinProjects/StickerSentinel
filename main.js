// Load environment variables as early as possible so config validation can run immediately.
require("dotenv").config();

const {
	Client,
	GatewayIntentBits,
	Partials,
	Events,
	StickerType,
	RESTJSONErrorCodes,
	PermissionFlagsBits,
	MessageFlags,
	ContainerBuilder,
	TextDisplayBuilder,
	SectionBuilder,
	SeparatorBuilder,
	SeparatorSpacingSize,
	ThumbnailBuilder,
} = require("discord.js");

// ============================================================================
// CONFIGURATION & VALIDATION
// ============================================================================

const config = Object.freeze({
	token: process.env.BOT_TOKEN,
	logChannelId: process.env.LOG_CHANNEL_ID,
	alertMention: process.env.ALERT_MENTION?.trim(),
});

/**
 * Validates required environment variables and exits if any are missing
 * @param {Object} cfg - Configuration object to validate
 */
function validateConfig(cfg) {
	const missing = [];
	if (!cfg.token) missing.push("BOT_TOKEN");
	if (!cfg.logChannelId) missing.push("LOG_CHANNEL_ID");

	if (missing.length > 0) {
		console.error(
			`[CONFIG ERROR] Missing required environment variables: ${missing.join(", ")}`,
		);
		console.error(
			"[CONFIG ERROR] Please check your .env file and ensure all required variables are set",
		);
		process.exit(1);
	}

	console.log("[CONFIG] ✓ Configuration validated successfully");
}

validateConfig(config);

// ============================================================================
// CLIENT INITIALIZATION
// ============================================================================

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildExpressions,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildModeration,
	],
	partials: [
		Partials.Channel,
		Partials.GuildMember,
		Partials.Message,
		Partials.Reaction,
		Partials.User,
	],
});

// ============================================================================
// EVENT HANDLERS
// ============================================================================

client.once(Events.ClientReady, () => {
	console.log(`[CLIENT] ✓ Logged in as ${client.user.tag}`);
	console.log(`[CLIENT] Monitoring ${client.guilds.cache.size} guild(s)`);
	console.log(`[CLIENT] Log channel ID: ${config.logChannelId}`);
});

client.on(Events.MessageCreate, async (message) => {
	try {
		// Only process guild messages with forwarding metadata
		if (!message.guildId) {
			return;
		}

		const snapshot = message.messageSnapshots?.first?.();
		if (!snapshot) {
			return;
		}

		const stickerIds = extractSnapshotStickerIds(snapshot);
		if (stickerIds.length === 0) {
			return;
		}

		console.log(
			`[DETECTION] Found ${stickerIds.length} sticker(s) in forwarded message from ${message.author?.tag ?? "Unknown"} (ID: ${message.author?.id ?? "Unknown"})`,
		);
		console.log(`[DETECTION] Sticker IDs: ${stickerIds.join(", ")}`);

		await processStickerMessage(message, stickerIds);
	} catch (error) {
		console.error(
			"[MESSAGE HANDLER] Unexpected error processing message:",
			error,
		);
		console.error("[MESSAGE HANDLER] Error stack:", error.stack);
	}
});

client.on(Events.Error, (error) => {
	console.error("[CLIENT ERROR] Discord client error:", error);
	console.error("[CLIENT ERROR] Error stack:", error.stack);
});

client.on(Events.Warn, (warning) => {
	console.warn("[CLIENT WARNING]", warning);
});

// ============================================================================
// CORE PROCESSING LOGIC
// ============================================================================

/**
 * Processes a message containing stickers and enforces policy
 * @param {Message} message - The Discord message to process
 * @param {string[]} stickerIds - Array of sticker IDs found in the message
 */
async function processStickerMessage(message, stickerIds) {
	try {
		// Fetch sticker metadata to determine origin
		const { resolved, failed } = await fetchStickerDetails({
			client,
			message,
			stickerIds,
		});

		console.log(
			`[STICKER FETCH] Successfully resolved ${resolved.length}/${stickerIds.length} sticker(s)`,
		);
		if (failed.length > 0) {
			console.warn(
				`[STICKER FETCH] Failed to resolve ${failed.length} sticker(s):`,
			);
			failed.forEach((entry) => {
				console.warn(
					`[STICKER FETCH]   - ID ${entry.id}: ${entry.message} (Code: ${entry.code})`,
				);
			});
		}

		// Determine if any stickers violate policy
		const hasOtherGuildSticker = resolved.some(
			(sticker) =>
				sticker.type === StickerType.Guild &&
				sticker.guildId &&
				sticker.guildId !== message.guildId,
		);
		const hasUnknownSticker = failed.some(
			(entry) => entry.code === RESTJSONErrorCodes.UnknownSticker,
		);
		const originUnknown = resolved.length === 0 && failed.length > 0;

		if (!hasOtherGuildSticker && !hasUnknownSticker && !originUnknown) {
			console.log(
				"[POLICY CHECK] All stickers are from current guild or are standard - no action needed",
			);
			return;
		}

		console.log("[POLICY CHECK] Policy violation detected:");
		if (hasOtherGuildSticker)
			console.log("[POLICY CHECK]   - External guild sticker detected");
		if (hasUnknownSticker)
			console.log("[POLICY CHECK]   - Unknown sticker detected");
		if (originUnknown)
			console.log(
				"[POLICY CHECK]   - Sticker origin could not be verified",
			);

		// Check if user has permission to bypass enforcement
		const permissionCheck = await resolveExternalStickerPermission(message);
		if (permissionCheck.allowed) {
			console.log(
				`[PERMISSION CHECK] User ${message.author?.tag ?? "Unknown"} has UseExternalStickers permission - skipping enforcement`,
			);
			return;
		}

		if (permissionCheck.checked) {
			console.log(
				`[PERMISSION CHECK] User ${message.author?.tag ?? "Unknown"} does not have UseExternalStickers permission - enforcing policy`,
			);
		} else {
			console.warn(
				"[PERMISSION CHECK] Could not verify permissions - proceeding with enforcement",
			);
		}

		// Build reason message for logging
		const reason = buildReasonMessage({
			hasOtherGuildSticker,
			hasUnknownSticker,
			originUnknown,
			permissionCheck,
		});

		// Enforce policy
		await handleForeignSticker({
			message,
			stickerIds,
			reason,
			details: {
				resolvedStickerDetails: resolved,
				failedStickerDetails: failed,
				permissionCheck,
			},
		});
	} catch (error) {
		console.error(
			"[STICKER PROCESSING] Error processing sticker message:",
			error,
		);
		console.error("[STICKER PROCESSING] Error stack:", error.stack);
		console.error("[STICKER PROCESSING] Message ID:", message.id);
		console.error("[STICKER PROCESSING] Channel ID:", message.channelId);
	}
}

/**
 * Handles a message containing foreign/unauthorized stickers
 * @param {Object} params - Parameters object
 * @param {Message} params.message - The message to handle
 * @param {string[]} params.stickerIds - Array of sticker IDs
 * @param {string} params.reason - Reason for enforcement
 * @param {Object} params.details - Additional details for logging
 */
async function handleForeignSticker({ message, stickerIds, reason, details }) {
	// Attempt to delete the offending message
	let deleteSuccess = false;
	try {
		if (message.deletable) {
			await message.delete();
			deleteSuccess = true;
			console.log(
				`[ENFORCEMENT] ✓ Successfully deleted message ${message.id} containing restricted sticker(s)`,
			);
		} else {
			console.warn(
				`[ENFORCEMENT] ✗ Message ${message.id} is not deletable - may lack permissions or message already deleted`,
			);
		}
	} catch (error) {
		console.error(
			`[ENFORCEMENT] ✗ Failed to delete message ${message.id}:`,
			error.message,
		);
		console.error("[ENFORCEMENT] Error code:", error.code);
	}

	// Log the enforcement action
	try {
		await logStickerRemoval({
			message,
			stickerIds,
			reason,
			details: {
				...details,
				deleteSuccess,
			},
		});
		console.log("[LOGGING] ✓ Enforcement action logged successfully");
	} catch (error) {
		console.error(
			"[LOGGING] ✗ Failed to log enforcement action:",
			error.message,
		);
		console.error("[LOGGING] Error stack:", error.stack);
	}
}

// ============================================================================
// LOGGING SYSTEM
// ============================================================================

/**
 * Ensures the log channel is fetched and cached
 * @param {Client} client - Discord client instance
 * @returns {Promise<Channel|null>} The log channel or null if unavailable
 */
async function ensureLogChannel(client) {
	// Return cached channel if already fetched
	if (client.logChannel?.id === config.logChannelId) {
		return client.logChannel;
	}

	try {
		console.log(
			`[LOG CHANNEL] Fetching log channel with ID: ${config.logChannelId}`,
		);
		const channel = await client.channels.fetch(config.logChannelId);

		if (!channel) {
			console.error(
				"[LOG CHANNEL] Channel not found - verify the LOG_CHANNEL_ID in your .env file",
			);
			return null;
		}

		if (!channel.isTextBased?.()) {
			console.error(
				`[LOG CHANNEL] Channel ${config.logChannelId} is not text-based - cannot send messages`,
			);
			return null;
		}

		// Join threads if necessary
		if (channel.isThread?.() && channel.joinable && !channel.joined) {
			console.log(`[LOG CHANNEL] Joining thread: ${channel.name}`);
			await channel.join();
		}

		client.logChannel = channel;
		console.log(
			`[LOG CHANNEL] ✓ Log channel ready: ${channel.name ?? "Unknown"} (ID: ${channel.id})`,
		);
		return channel;
	} catch (error) {
		console.error(
			`[LOG CHANNEL] ✗ Failed to fetch log channel ${config.logChannelId}:`,
			error.message,
		);
		console.error("[LOG CHANNEL] Error code:", error.code);
		console.error(
			"[LOG CHANNEL] Ensure the bot has access to the channel and the ID is correct",
		);
		return null;
	}
}

/**
 * Logs sticker removal with Components V2
 * @param {Object} params - Logging parameters
 */
async function logStickerRemoval({ message, stickerIds, reason, details }) {
	const channel = await ensureLogChannel(message.client);
	if (!channel) {
		console.error("[LOG MESSAGE] Cannot log - log channel unavailable");
		return;
	}

	try {
		const container = buildLogContainer(
			message,
			stickerIds,
			reason,
			details,
		);

		await channel.send({
			components: [container],
			flags: MessageFlags.IsComponentsV2,
		});

		console.log(
			`[LOG MESSAGE] ✓ Log message sent to channel ${channel.name ?? channel.id}`,
		);
	} catch (error) {
		console.error(
			"[LOG MESSAGE] ✗ Failed to send log message:",
			error.message,
		);
		console.error("[LOG MESSAGE] Error code:", error.code);

		if (error.code === 50035) {
			console.error(
				"[LOG MESSAGE] API Error 50035 - Invalid form body. This may indicate Components V2 formatting issues",
			);
		} else if (error.code === 50013) {
			console.error(
				"[LOG MESSAGE] Missing permissions to send messages in the log channel",
			);
		}

		console.error("[LOG MESSAGE] Full error:", error);
	}
}

/**
 * Builds a Components V2 container for logging
 * @param {Message} message - The Discord message
 * @param {string[]} stickerIds - Array of sticker IDs
 * @param {string} reason - Reason for enforcement
 * @param {Object} details - Additional details
 * @returns {ContainerBuilder} Configured container
 */
function buildLogContainer(message, stickerIds, reason, details) {
	const messageUrl = `https://discord.com/channels/${message.guildId}/${message.channelId}/${message.id}`;
	const channelUrl = `https://discord.com/channels/${message.guildId}/${message.channelId}`;
	const userUrl = message.author
		? `https://discord.com/users/${message.author.id}`
		: null;
	const resolvedStickers = details.resolvedStickerDetails ?? [];
	const deleteStatus = details.deleteSuccess
		? "✓ Message deleted"
		: "✗ Message deletion failed";

	const container = new ContainerBuilder().setAccentColor(0xf97316);

	// Add mention if configured
	if (config.alertMention) {
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(`-# ${config.alertMention}`),
		);
		container.addSeparatorComponents(
			new SeparatorBuilder()
				.setSpacing(SeparatorSpacingSize.Small)
				.setDivider(true),
		);
	}

	// Header
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			"## 🚫 Sticker Bypassing Detected 🚫",
		),
	);
	container.addSeparatorComponents(
		new SeparatorBuilder()
			.setSpacing(SeparatorSpacingSize.Small)
			.setDivider(true),
	);

	// Reason and Status
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent("- **Reason**:\n> " + reason),
		new TextDisplayBuilder().setContent("- **Action**:\n> " + deleteStatus),
	);
	container.addSeparatorComponents(
		new SeparatorBuilder()
			.setSpacing(SeparatorSpacingSize.Small)
			.setDivider(true),
	);

	// Author Section
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent("### 👤 Forwarded By"),
	);

	const authorSection = new SectionBuilder();

	if (message.author?.displayAvatarURL) {
		try {
			authorSection.setThumbnailAccessory(
				new ThumbnailBuilder()
					.setURL(
						message.author.displayAvatarURL({
							size: 2048,
							extension: "png",
						}),
					)
					.setDescription("User Avatar"),
			);
		} catch (error) {
			console.warn(
				"[LOG BUILDER] Could not set user avatar thumbnail:",
				error.message,
			);
		}
	}

	authorSection.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			"- **Mention**:\n> " +
				(message.author ? `<@${message.author.id}>` : "Unknown"),
		),
		new TextDisplayBuilder().setContent(
			"- **ID**:\n> " + (message.author?.id ?? "Unknown"),
		),
		new TextDisplayBuilder().setContent(
			"- **Tag**:\n> " + (message.author?.tag ?? "Unknown"),
		),
	);

	container.addSectionComponents(authorSection);

	// Context Section
	container.addSeparatorComponents(
		new SeparatorBuilder()
			.setSpacing(SeparatorSpacingSize.Small)
			.setDivider(true),
	);
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent("### 📍 Context"),
	);
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			"- **Channel**:\n> <#" + message.channelId + ">",
		),
		new TextDisplayBuilder().setContent(
			"- **Message**:\n> [Jump to Message](" + messageUrl + ")",
		),
		new TextDisplayBuilder().setContent(
			"- **Sticker IDs**:\n> " + stickerIds.join(", "),
		),
	);

	// Permission Status
	if (details.permissionCheck?.checked) {
		const permStatus = details.permissionCheck.allowed
			? "✅ Has external sticker access"
			: "❌ No external sticker access";
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				"- **Permission**:\n> " + permStatus,
			),
		);
	}

	// Sticker Details
	container.addSeparatorComponents(
		new SeparatorBuilder()
			.setSpacing(SeparatorSpacingSize.Small)
			.setDivider(true),
	);
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent("### 🎨 Sticker Details"),
	);

	if (resolvedStickers.length > 0) {
		for (const sticker of resolvedStickers) {
			try {
				const stickerSection = buildStickerSection(sticker);
				container.addSectionComponents(stickerSection);
			} catch (error) {
				console.warn(
					`[LOG BUILDER] Error building section for sticker ${sticker.id}:`,
					error.message,
				);
			}
		}
	} else {
		// Show sticker thumbnails even when metadata unavailable
		for (const stickerId of stickerIds) {
			try {
				const stickerSection = buildUnknownStickerSection(stickerId);
				container.addSectionComponents(stickerSection);
			} catch (error) {
				console.warn(
					`[LOG BUILDER] Error building section for unknown sticker ${stickerId}:`,
					error.message,
				);
			}
		}
	}

	// Links Section
	container.addSeparatorComponents(
		new SeparatorBuilder()
			.setSpacing(SeparatorSpacingSize.Small)
			.setDivider(true),
	);
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent("### 🔗 Links"),
	);

	const linkTexts = [];
	linkTexts.push(`- [Open Channel](${channelUrl})`);
	if (messageUrl) {
		linkTexts.push(`- [Original Message](${messageUrl})`);
	}
	if (userUrl) {
		linkTexts.push(`- [View User Profile](${userUrl})`);
	}

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(linkTexts.join("\n")),
	);

	return container;
}

/**
 * Builds a section for a resolved sticker
 * @param {Object} sticker - Sticker details
 * @returns {SectionBuilder} Configured section
 */
function buildStickerSection(sticker) {
	const stickerSection = new SectionBuilder();

	if (sticker.thumbnailUrl) {
		stickerSection.setThumbnailAccessory(
			new ThumbnailBuilder()
				.setURL(sticker.thumbnailUrl)
				.setDescription(`Sticker:\n> ${sticker.name}`),
		);
	}

	stickerSection.addTextDisplayComponents(
		new TextDisplayBuilder().setContent("- **Name**:\n> " + sticker.name),
		new TextDisplayBuilder().setContent("- **ID**:\n> " + sticker.id),
		new TextDisplayBuilder().setContent(
			"- **Type**:\n> " + describeStickerType(sticker.type),
		),
	);

	if (sticker.guildId) {
		stickerSection.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				"- **Origin Guild**:\n> " + sticker.guildId,
			),
		);
	}

	return stickerSection;
}

/**
 * Builds a section for an unknown sticker
 * @param {string} stickerId - Sticker ID
 * @returns {SectionBuilder} Configured section
 */
function buildUnknownStickerSection(stickerId) {
	const stickerSection = new SectionBuilder();
	const stickerUrl = `https://media.discordapp.net/stickers/${stickerId}.png?size=1024`;

	stickerSection.setThumbnailAccessory(
		new ThumbnailBuilder()
			.setURL(stickerUrl)
			.setDescription("Sticker preview"),
	);

	stickerSection.addTextDisplayComponents(
		new TextDisplayBuilder().setContent("- **ID**:\n> " + stickerId),
		new TextDisplayBuilder().setContent(
			"- **Status**:\n> Metadata unavailable",
		),
	);

	return stickerSection;
}

// ============================================================================
// STICKER UTILITIES
// ============================================================================

/**
 * Extracts sticker IDs from a message snapshot
 * @param {Object} snapshot - Message snapshot
 * @returns {string[]} Array of sticker IDs
 */
function extractSnapshotStickerIds(snapshot) {
	if (!snapshot?.stickers) {
		return [];
	}

	try {
		// Handle array format
		if (Array.isArray(snapshot.stickers)) {
			return snapshot.stickers
				.map((sticker) =>
					typeof sticker === "string" ? sticker : sticker?.id,
				)
				.filter(Boolean);
		}

		// Handle Collection format
		if (typeof snapshot.stickers.size === "number") {
			return [...snapshot.stickers.values()]
				.map((sticker) => sticker?.id ?? sticker)
				.filter(Boolean);
		}

		return [];
	} catch (error) {
		console.error("[STICKER EXTRACT] Error extracting sticker IDs:", error);
		return [];
	}
}

/**
 * Fetches detailed information for stickers
 * @param {Object} params - Parameters
 * @param {Client} params.client - Discord client
 * @param {Message} params.message - Message containing stickers
 * @param {string[]} params.stickerIds - Array of sticker IDs to fetch
 * @returns {Promise<Object>} Object with resolved and failed arrays
 */
async function fetchStickerDetails({ client, message, stickerIds }) {
	const resolved = [];
	const failed = [];

	await Promise.all(
		stickerIds.map(async (stickerId) => {
			try {
				// Check local caches first to avoid unnecessary API calls
				const cachedSticker =
					message.stickers?.get?.(stickerId) ||
					message.guild?.stickers?.resolve?.(stickerId) ||
					client.stickers?.resolve?.(stickerId);

				if (cachedSticker) {
					resolved.push(formatStickerDetails(cachedSticker));
					return;
				}

				// Fetch from API if not cached
				const sticker = await client.fetchSticker(stickerId);
				resolved.push(formatStickerDetails(sticker));
			} catch (error) {
				const errorInfo = {
					id: stickerId,
					message: error?.message ?? "Unknown error occurred",
					code: error?.code ?? "UNKNOWN_ERROR",
				};
				failed.push(errorInfo);
			}
		}),
	);

	return { resolved, failed };
}

/**
 * Formats sticker details into a consistent object
 * @param {Sticker} sticker - Discord sticker object
 * @returns {Object} Formatted sticker details
 */
function formatStickerDetails(sticker) {
	// Determine thumbnail URL with fallbacks
	let thumbnailUrl = sticker.asset ?? sticker.coverImage;

	if (!thumbnailUrl) {
		thumbnailUrl = `https://media.discordapp.net/stickers/${sticker.id}.png?size=256`;
	}

	return {
		id: sticker.id,
		name: sticker.name ?? "Unknown",
		type: sticker.type,
		guildId: sticker.guildId ?? null,
		thumbnailUrl,
	};
}

/**
 * Converts sticker type enum to human-readable string
 * @param {number} type - Sticker type enum value
 * @returns {string} Human-readable type
 */
function describeStickerType(type) {
	switch (type) {
		case StickerType.Guild:
			return "Guild Sticker";
		case StickerType.Standard:
			return "Standard Sticker";
		default:
			return `Unknown Type (${type ?? "null"})`;
	}
}

// ============================================================================
// PERMISSION UTILITIES
// ============================================================================

/**
 * Checks if a user has permission to use external stickers
 * @param {Message} message - The message to check permissions for
 * @returns {Promise<Object>} Object with allowed and checked properties
 */
async function resolveExternalStickerPermission(message) {
	if (!message.guild || !message.author) {
		console.warn(
			"[PERMISSION] Cannot check permissions - missing guild or author",
		);
		return { allowed: false, checked: false };
	}

	try {
		// Fetch member if not already present (common with forwarded messages)
		let member = message.member;
		if (!member) {
			console.log(
				`[PERMISSION] Fetching member data for user ${message.author.id}`,
			);
			member = await message.guild.members.fetch(message.author.id);
		}

		// Check for UseExternalStickers permission
		const hasPermission = member.permissions?.has?.(
			PermissionFlagsBits.UseExternalStickers,
			true,
		);

		if (typeof hasPermission === "boolean") {
			return { allowed: hasPermission, checked: true };
		}

		console.warn(
			"[PERMISSION] Permission check returned non-boolean value",
		);
		return { allowed: false, checked: false };
	} catch (error) {
		console.warn(
			`[PERMISSION] Unable to fetch member or check permissions: ${error.message}`,
		);
		console.warn("[PERMISSION] Error code:", error.code);
		return { allowed: false, checked: false };
	}
}

// ============================================================================
// MESSAGE UTILITIES
// ============================================================================

/**
 * Builds a human-readable reason message
 * @param {Object} params - Reason parameters
 * @returns {string} Formatted reason message
 */
function buildReasonMessage({
	hasOtherGuildSticker,
	hasUnknownSticker,
	originUnknown,
	permissionCheck,
}) {
	const reasons = [];

	if (hasOtherGuildSticker) {
		reasons.push("External server sticker");
	}
	if (hasUnknownSticker) {
		reasons.push("Unknown/deleted sticker");
	}
	if (originUnknown) {
		reasons.push("Unverified origin");
	}

	if (reasons.length === 0) {
		return "Sticker policy violation";
	}

	return reasons.join(" • ");
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

process.on("unhandledRejection", (reason, promise) => {
	console.error("[UNHANDLED REJECTION] Unhandled promise rejection detected");
	console.error("[UNHANDLED REJECTION] Promise:", promise);
	console.error("[UNHANDLED REJECTION] Reason:", reason);
	if (reason instanceof Error) {
		console.error("[UNHANDLED REJECTION] Stack:", reason.stack);
	}
});

process.on("uncaughtException", (error) => {
	console.error("[UNCAUGHT EXCEPTION] Uncaught exception detected");
	console.error("[UNCAUGHT EXCEPTION] Error:", error);
	console.error("[UNCAUGHT EXCEPTION] Stack:", error.stack);
	console.error("[UNCAUGHT EXCEPTION] The process will now exit");
	process.exit(1);
});

// ============================================================================
// CLIENT LOGIN
// ============================================================================

console.log("[STARTUP] Initializing bot...");
client.login(config.token).catch((error) => {
	console.error("[LOGIN] Failed to login to Discord:", error.message);
	console.error("[LOGIN] Please verify your BOT_TOKEN is correct");
	process.exit(1);
});

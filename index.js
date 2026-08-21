'use strict';

const { AttachmentBuilder, Client, GatewayIntentBits, Partials } = require('discord.js');
const { createCompositeImage } = require('./canvasy');
const { createOperationsAgentRuntime } = require('./src/agent');
const { createValidatorLeaseInquiry, formatLeaseInquiry } = require('./src/lease');
const { SolanaValidationError, validateGameToken } = require('./src/solana');

const DISCORD_REPLY_LIMIT = 1_900;

function parseIdSet(value) {
    if (typeof value !== 'string' || value.trim() === '') {
        return new Set();
    }

    return new Set(value
        .split(',')
        .map((id) => id.trim())
        .filter((id) => /^\d{5,25}$/.test(id)));
}

function parseInteger(value, fallback, { minimum, maximum }) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum
        ? parsed
        : fallback;
}

function getBotConfig(env = process.env) {
    return {
        botToken: env.BOT_TOKEN || env.DISCORD_BOT_TOKEN,
        welcomeChannelId: env.WELCOME_CHANNEL_ID,
        discordInviteUrl: env.DISCORD_INVITE_URL || 'https://discord.gg/YJ5B2YRRP',
        gitlab: {
            baseUrl: env.GITLAB_BASE_URL || 'https://gitlab.com',
            clientId: env.GITLAB_CLIENT_ID,
            redirectUri: env.GITLAB_REDIRECT_URI
        },
        gasNetwork: env.GAS_NETWORK || 'base',
        publicTreasuryAddress: env.PUBLIC_TREASURY_ADDRESS || '',
        skygridStatusUrl: env.SKYGRID_STATUS_URL || 'https://skygrid-protocol.net/api/status',
        solanaRpcUrl: env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
        solanaCluster: env.SOLANA_CLUSTER || 'mainnet-beta',
        openAiConfigured: Boolean(env.OPENAI_API_KEY),
        openAiModel: env.OPENAI_MODEL || 'gpt-5.6-luna',
        allowedGuildIds: parseIdSet(env.DISCORD_ALLOWED_GUILD_IDS),
        agentChannelIds: parseIdSet(env.DISCORD_AGENT_CHANNEL_IDS),
        allowDirectMessages: env.DISCORD_ALLOW_DMS === 'true',
        agentCooldownMs: parseInteger(env.AGENT_COOLDOWN_MS, 5_000, {
            minimum: 0,
            maximum: 300_000
        }),
        agentMaxInputChars: parseInteger(env.AGENT_MAX_INPUT_CHARS, 1_500, {
            minimum: 100,
            maximum: 8_000
        }),
        leaseContact: env.VALIDATOR_LEASE_CONTACT || 'not configured',
        agentTracingEnabled: env.OPENAI_AGENT_TRACING === 'true'
    };
}

function buildGitlabOauthUrl({ baseUrl, clientId, redirectUri }) {
    if (!clientId || !redirectUri) {
        return null;
    }

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'read_user api'
    });

    return `${baseUrl}/oauth/authorize?${params.toString()}`;
}

function truncateDiscordReply(value, limit = DISCORD_REPLY_LIMIT) {
    const text = String(value || '').trim();

    if (text.length <= limit) {
        return text;
    }

    return `${text.slice(0, limit - 21).trimEnd()}\n… reply truncated`;
}

function safeReply(message, content) {
    return message.reply({
        content: truncateDiscordReply(content),
        allowedMentions: {
            parse: [],
            repliedUser: false
        }
    });
}

function looksLikeCredential(value) {
    if (typeof value !== 'string') {
        return false;
    }

    const labeledSecret = /\b(?:seed|recovery)\s+phrase\s*[:=]\s*\S+|\b(?:private|secret|signing)\s+key\s*[:=]\s*\S+/i;
    const openAiKey = /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/;
    const discordToken = /\b(?:mfa\.[\w-]{20,}|[\w-]{20,}\.[\w-]{6}\.[\w-]{20,})\b/;
    const byteArray = /\[(?:\s*\d{1,3}\s*,){31,}\s*\d{1,3}\s*\]/;

    return labeledSecret.test(value)
        || openAiKey.test(value)
        || discordToken.test(value)
        || byteArray.test(value);
}

function extractAgentPrompt(content, botUserId) {
    if (typeof content !== 'string') {
        return null;
    }

    const prefix = content.match(/^!agent(?:\s+|$)/i);

    if (prefix) {
        return content.slice(prefix[0].length).trim();
    }

    if (!botUserId || !/^\d+$/.test(botUserId)) {
        return null;
    }

    const mentionPattern = new RegExp(`<@!?${botUserId}>`, 'g');

    if (!mentionPattern.test(content)) {
        return null;
    }

    return content.replace(mentionPattern, ' ').replace(/^\s*[:,;-]?\s*/, '').trim();
}

function isAllowedLocation(message, config) {
    if (!message.guildId) {
        return config.allowDirectMessages;
    }

    if (config.allowedGuildIds.size > 0 && !config.allowedGuildIds.has(message.guildId)) {
        return false;
    }

    return config.agentChannelIds.size === 0 || config.agentChannelIds.has(message.channelId);
}

function formatTokenValidation(result) {
    if (!result.validated) {
        return [
            '🧪 **Solana game-token validation**',
            `Status: ${result.status}`,
            `Mint: \`${result.mintAddress}\``,
            `Cluster: ${result.cluster}`,
            result.reason ? `Reason: ${result.reason}` : null,
            result.programOwner ? `Program owner: \`${result.programOwner}\`` : null,
            result.disclaimer
        ].filter(Boolean).join('\n');
    }

    const ownerLines = result.ownerBalance
        ? [
            `Owner wallet: \`${result.ownerBalance.wallet}\``,
            `Owner balance: ${result.ownerBalance.uiAmount} (${result.ownerBalance.rawAmount} raw units)`,
            `Owner token accounts parsed: ${result.ownerBalance.parsedAccountCount}/${result.ownerBalance.tokenAccountCount}`
        ]
        : [];

    return [
        '🧪 **Solana game-token validation**',
        'Status: initialized mint account confirmed',
        `Mint: \`${result.mintAddress}\``,
        `Cluster: ${result.cluster}`,
        `Token program: ${result.program}`,
        `Decimals: ${result.decimals}`,
        `Supply: ${result.supplyUi} (${result.supplyRaw} raw units)`,
        `Mint authority: ${result.mintAuthority ? `\`${result.mintAuthority}\`` : 'revoked / none'}`,
        `Freeze authority: ${result.freezeAuthority ? `\`${result.freezeAuthority}\`` : 'none'}`,
        result.extensions.length > 0 ? `Token-2022 extensions: ${result.extensions.join(', ')}` : null,
        ...ownerLines,
        result.slot ? `Confirmed RPC slot: ${result.slot}` : null,
        result.disclaimer
    ].filter(Boolean).join('\n');
}

function safeErrorMetadata(error) {
    return {
        name: error && typeof error.name === 'string' ? error.name : 'Error',
        code: error && typeof error.code === 'string' ? error.code : undefined,
        status: Number.isInteger(error && error.status) ? error.status : undefined
    };
}

function createCommandHandlers(config) {
    return new Map([
        ['!help', () => [
            '🤖 **Available commands**',
            '`!agent <request>` or mention me - Ask the guarded operations agent.',
            '`!agent status` - Show agent readiness without an API call.',
            '`!token <mint> [owner-wallet]` - Validate public Solana mint facts and optional holdings.',
            '`!lease <console-count> [requirements]` - Create a lease-intake draft for human review.',
            '`!connect-gitlab` - Get the configured GitLab OAuth link.',
            '`!gas status` - Show the configured network watch label.',
            '`!bridge status` - Show Discord bridge readiness.',
            '`!skygrid status` - Show the configured SKYGRID status URL.'
        ].join('\n')],
        ['!agent status', () => [
            '🤖 **Agent status**',
            `OpenAI agent: ${config.openAiConfigured ? 'configured' : 'not configured'}`,
            `Model: ${config.openAiModel}`,
            `Solana cluster: ${config.solanaCluster}`,
            'Token validation: read-only RPC',
            'Lease workflow: intake draft with required human approval',
            'Wallet and validator signing: disabled'
        ].join('\n')],
        ['!gas status', () => [
            '⚡ **Gas Watch Status**',
            `Network: ${config.gasNetwork}`,
            `Watch address: ${config.publicTreasuryAddress || 'not configured'}`,
            'Mode: read-only status display'
        ].join('\n')],
        ['!bridge status', () => [
            '🌉 **Bridge Status**',
            'Discord command layer: online',
            'Operations docs: docs/discord-operations.md',
            'Solana validation: read-only',
            'Transaction signing: disabled'
        ].join('\n')],
        ['!skygrid status', () => [
            '🛰️ **SKYGRID Status**',
            `Status endpoint: ${config.skygridStatusUrl}`,
            'Live fetch: pending integration'
        ].join('\n')]
    ]);
}

function createBot({
    env = process.env,
    fetchImpl = globalThis.fetch,
    agentRuntimeFactory = createOperationsAgentRuntime
} = {}) {
    const config = getBotConfig(env);
    const commandHandlers = createCommandHandlers(config);
    const cooldowns = new Map();
    const agentRuntime = config.openAiConfigured
        ? agentRuntimeFactory({
            rpcUrl: config.solanaRpcUrl,
            cluster: config.solanaCluster,
            fetchImpl,
            leaseContact: config.leaseContact,
            model: config.openAiModel,
            enableTracing: config.agentTracingEnabled
        })
        : null;

    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.DirectMessages,
            GatewayIntentBits.MessageContent
        ],
        partials: [Partials.Channel]
    });

    client.once('ready', () => {
        console.log(`Bot is online as ${client.user.tag}`);
    });

    client.on('guildMemberAdd', async (member) => {
        if (!config.welcomeChannelId) {
            return;
        }

        try {
            const originalUrl = member.user.displayAvatarURL({ extension: 'png', size: 1024 });
            const imageBuffer = await createCompositeImage(
                originalUrl,
                member.guild.memberCount,
                member.user.username
            );
            const channel = member.guild.channels.cache.get(config.welcomeChannelId);

            if (!channel || !channel.isTextBased()) {
                console.warn('Welcome channel is not available in this guild.');
                return;
            }

            const attachment = new AttachmentBuilder(imageBuffer, { name: 'welcome-image.jpg' });
            const welcomeMessage = [
                `Welcome to our community, ${member.user.username}! With you, we are ${member.guild.memberCount} members. 🎉`,
                "Visit CodeGPT Studio to customize your agents: https://app.codegpt.co/en",
                `Community invite: ${config.discordInviteUrl}`
            ].join('\n');

            await channel.send({
                content: welcomeMessage,
                files: [attachment],
                allowedMentions: { parse: [] }
            });
        } catch (error) {
            console.error('Welcome message failed.', safeErrorMetadata(error));
        }
    });

    client.on('messageCreate', async (message) => {
        if (message.author.bot) {
            return;
        }

        const rawContent = message.content.trim();
        const normalizedContent = rawContent.toLowerCase();

        if (normalizedContent === '!connect-gitlab') {
            const oauthUrl = buildGitlabOauthUrl(config.gitlab);
            await safeReply(message, oauthUrl
                ? `Connect your GitLab account here: ${oauthUrl}`
                : 'GitLab connection is not configured. Set GITLAB_CLIENT_ID and GITLAB_REDIRECT_URI.');
            return;
        }

        const commandHandler = commandHandlers.get(normalizedContent);

        if (commandHandler) {
            await safeReply(message, commandHandler());
            return;
        }

        if (/^!token(?:\s+|$)/i.test(rawContent)) {
            if (!isAllowedLocation(message, config)) {
                await safeReply(message, 'Solana validation is not enabled in this guild or channel.');
                return;
            }

            const argumentsList = rawContent.split(/\s+/).slice(1);

            if (argumentsList.length < 1 || argumentsList.length > 2) {
                await safeReply(message, 'Usage: `!token <mint-address> [public-owner-wallet]`');
                return;
            }

            try {
                const result = await validateGameToken({
                    mintAddress: argumentsList[0],
                    ownerWallet: argumentsList[1],
                    rpcUrl: config.solanaRpcUrl,
                    cluster: config.solanaCluster,
                    fetchImpl
                });
                await safeReply(message, formatTokenValidation(result));
            } catch (error) {
                const code = error instanceof SolanaValidationError ? error.code : 'VALIDATION_FAILED';
                await safeReply(message, `Solana validation could not complete safely (${code}). No transaction was created or signed.`);
                console.error('Solana validation failed.', safeErrorMetadata(error));
            }

            return;
        }

        if (/^!lease(?:\s+|$)/i.test(rawContent)) {
            if (!isAllowedLocation(message, config)) {
                await safeReply(message, 'Lease intake is not enabled in this guild or channel.');
                return;
            }

            const match = rawContent.match(/^!lease\s+(\d+)(?:\s+([\s\S]+))?$/i);

            if (!match) {
                await safeReply(message, 'Usage: `!lease <console-count> [exchange/operator, network, term, and requirements]`');
                return;
            }

            const consoleCount = Number.parseInt(match[1], 10);

            try {
                const inquiry = createValidatorLeaseInquiry({
                    requester: message.author.tag || message.author.username,
                    exchangeOrOperator: 'not provided',
                    consoleCount,
                    network: 'other',
                    term: 'unspecified',
                    requirements: match[2] || 'not provided',
                    contact: config.leaseContact
                });
                await safeReply(message, formatLeaseInquiry(inquiry));
            } catch {
                await safeReply(message, 'Console count must be a whole number from 1 through 100.');
            }

            return;
        }

        const agentPrompt = extractAgentPrompt(rawContent, client.user && client.user.id);

        if (agentPrompt === null) {
            return;
        }

        if (!isAllowedLocation(message, config)) {
            await safeReply(message, 'The agent is not enabled in this guild or channel.');
            return;
        }

        if (!agentPrompt) {
            await safeReply(message, 'Usage: `!agent <question>` or mention me with a question.');
            return;
        }

        if (!agentRuntime) {
            await safeReply(message, 'The agent is not configured yet. Set OPENAI_API_KEY in the bot runtime.');
            return;
        }

        if (agentPrompt.length > config.agentMaxInputChars) {
            await safeReply(message, `Agent requests are limited to ${config.agentMaxInputChars} characters.`);
            return;
        }

        if (looksLikeCredential(agentPrompt)) {
            await safeReply(message, 'I will not process credentials or signing material. Delete the exposed secret, rotate it, and ask again using public addresses only.');
            return;
        }

        const cooldownKey = `${message.guildId || 'dm'}:${message.author.id}`;
        const lastRequestAt = cooldowns.get(cooldownKey) || 0;
        const retryAfterMs = config.agentCooldownMs - (Date.now() - lastRequestAt);

        if (retryAfterMs > 0) {
            await safeReply(message, `Please wait ${Math.ceil(retryAfterMs / 1_000)} second(s) before another agent request.`);
            return;
        }

        cooldowns.set(cooldownKey, Date.now());

        try {
            if (typeof message.channel.sendTyping === 'function') {
                await message.channel.sendTyping();
            }

            const output = await agentRuntime.run(agentPrompt);
            await safeReply(message, output);
        } catch (error) {
            console.error('Agent request failed.', safeErrorMetadata(error));
            await safeReply(message, 'The agent could not complete that request. No transaction, lease, payment, or validator action was performed.');
        }
    });

    return {
        client,
        config,
        async start() {
            if (!config.botToken) {
                throw new Error('BOT_TOKEN is not configured.');
            }

            return client.login(config.botToken);
        }
    };
}

async function startBot(options) {
    const bot = createBot(options);
    await bot.start();
    return bot;
}

if (require.main === module) {
    startBot().catch((error) => {
        console.error('Bot startup failed.', safeErrorMetadata(error));
        process.exitCode = 1;
    });
}

module.exports = {
    buildGitlabOauthUrl,
    createBot,
    extractAgentPrompt,
    formatTokenValidation,
    getBotConfig,
    isAllowedLocation,
    looksLikeCredential,
    parseIdSet,
    safeReply,
    startBot,
    truncateDiscordReply
};

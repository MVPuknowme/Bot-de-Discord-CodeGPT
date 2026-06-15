const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const { createCompositeImage } = require('./canvasy');

const gitlabConfig = {
    baseUrl: process.env.GITLAB_BASE_URL || 'https://gitlab.com',
    clientId: process.env.GITLAB_CLIENT_ID,
    redirectUri: process.env.GITLAB_REDIRECT_URI
};

const discordInviteUrl = process.env.DISCORD_INVITE_URL || 'https://discord.gg/YJ5B2YRRP';
const welcomeChannelId = process.env.WELCOME_CHANNEL_ID;
const botToken = process.env.BOT_TOKEN;
const gasNetwork = process.env.GAS_NETWORK || 'base';
const publicTreasuryAddress = process.env.PUBLIC_TREASURY_ADDRESS || '';
const skygridStatusUrl = process.env.SKYGRID_STATUS_URL || 'https://skygrid-protocol.net/api/status';

const buildGitlabOauthUrl = ({ baseUrl, clientId, redirectUri }) => {
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
};

const commandHandlers = new Map([
    ['!help', () => [
        '🤖 **Available commands**',
        '`!connect-gitlab` - Get the configured GitLab OAuth link.',
        '`!gas status` - Show the configured network watch label.',
        '`!bridge status` - Show Discord bridge readiness.',
        '`!skygrid status` - Show the configured SKYGRID status URL.'
    ].join('\n')],
    ['!gas status', () => [
        '⚡ **Gas Watch Status**',
        `Network: ${gasNetwork}`,
        `Watch address: ${publicTreasuryAddress || 'not configured'}`,
        'Mode: read-only status display'
    ].join('\n')],
    ['!bridge status', () => [
        '🌉 **Bridge Status**',
        'Discord command layer: online',
        'Operations docs: docs/discord-operations.md',
        'Live telemetry: pending integration'
    ].join('\n')],
    ['!skygrid status', () => [
        '🛰️ **SKYGRID Status**',
        `Status endpoint: ${skygridStatusUrl}`,
        'Live fetch: pending integration'
    ].join('\n')]
]);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', () => {
    console.log(`Bot is online as ${client.user.tag}`);
});

client.on('guildMemberAdd', async (member) => {
    const originalUrl = member.user.displayAvatarURL({ format: 'png', dynamic: true, size: 1024 });
    const avatarURL = originalUrl.replace('.webp', '.png');
    const memberCount = member.guild.memberCount;
    const memberName = member.user.username;
    const imageBuffer = await createCompositeImage(avatarURL, memberCount, memberName);

    if (!welcomeChannelId) {
        console.log('WELCOME_CHANNEL_ID is not configured; skipping welcome message.');
        return;
    }

    const channel = member.guild.channels.cache.get(welcomeChannelId);

    if (channel) {
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'welcome-image.jpg' });
        const welcomeMessage = [
            `Welcome to our community, ${member.user.username}! With you, we are ${memberCount} members. 🎉`,
            "Click [here](https://app.codegpt.co/en) to access CodeGPT's Studio and start customizing your agents! 🤖",
            `Join our Discord server: ${discordInviteUrl}`
        ].join('\n');
        channel.send({ content: welcomeMessage, files: [attachment] });
    } else {
        console.log('Welcome channel not found');
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) {
        return;
    }

    const content = message.content.trim().toLowerCase();

    if (content === '!connect-gitlab') {
        const oauthUrl = buildGitlabOauthUrl(gitlabConfig);

        if (!oauthUrl) {
            await message.reply('GitLab connection is not configured yet. Please set GITLAB_CLIENT_ID and GITLAB_REDIRECT_URI.');
            return;
        }

        await message.reply(`Connect your GitLab account here: ${oauthUrl}`);
        return;
    }

    const handler = commandHandlers.get(content);

    if (handler) {
        await message.reply(handler());
    }
});

if (!botToken) {
    console.error('BOT_TOKEN is not configured.');
    process.exit(1);
}

client.login(botToken);

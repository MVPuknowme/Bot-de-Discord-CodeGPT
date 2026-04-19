const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const { createCompositeImage } = require('./canvasy'); // Import the function from canvasy.js

const gitlabConfig = {
    baseUrl: process.env.GITLAB_BASE_URL || 'https://gitlab.com',
    clientId: process.env.GITLAB_CLIENT_ID,
    redirectUri: process.env.GITLAB_REDIRECT_URI
};
const discordInviteUrl = 'https://discord.gg/YJ5B2YRRP';
const welcomeChannelId = process.env.WELCOME_CHANNEL_ID;
const botToken = process.env.BOT_TOKEN;

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

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers, // Required to listen for member join events
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Log in when the bot is ready
client.once('ready', () => {
    console.log('Bot is online!');
});

client.on('guildMemberAdd', async (member) => {
    // Get the profile picture URL of the member
    const originalUrl = member.user.displayAvatarURL({ format: 'png', dynamic: true, size: 1024 });
    const avatarURL = originalUrl.replace('.webp', '.png');

    // Get the number of members in the server
    const memberCount = member.guild.memberCount;

    // Get the user's name of the member
    const memberName = member.user.username;

    // Create the image buffer using the profile picture
    const imageBuffer = await createCompositeImage(avatarURL, memberCount, memberName);

    if (!welcomeChannelId) {
        console.log('WELCOME_CHANNEL_ID is not configured; skipping welcome message.');
        return;
    }

    const channel = member.guild.channels.cache.get(welcomeChannelId);

    // Send the image and a welcome message if the channel exists
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

    if (message.content.toLowerCase() !== '!connect-gitlab') {
        return;
    }

    const oauthUrl = buildGitlabOauthUrl(gitlabConfig);

    if (!oauthUrl) {
        await message.reply(
            'GitLab connection is not configured yet. Please set GITLAB_CLIENT_ID and GITLAB_REDIRECT_URI.'
        );
        return;
    }

    await message.reply(`Connect your GitLab account here: ${oauthUrl}`);
});

// Log in to Discord with your bot token
if (!botToken) {
    console.error('BOT_TOKEN is not configured.');
    process.exit(1);
}

client.login(botToken);

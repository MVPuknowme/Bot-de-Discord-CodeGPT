const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const { createCompositeImage } = require('./canvasy'); // Import the function from canvasy.js
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers // Required to listen for member join events
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

    // Define the ID of the welcome channel
    const welcomeChannelId = 'INSERT-CHANNEL-ID'; // Replace with your channel ID

    // Find the welcome channel
    const channel = member.guild.channels.cache.get(welcomeChannelId);

    // Send the image and a welcome message if the channel exists
    if (channel) {
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'welcome-image.jpg' });
        channel.send({ content: `Welcome to the server, ${member.user.username}! 🎉`, files: [attachment] }); // This is the channel message
    } else {
        console.log('Welcome channel not found');
    }
});

// Log in to Discord with your bot token
client.login("INSERT-BOT-TOKEN");

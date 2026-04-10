const { Client, GatewayIntentBits, EmbedBuilder, ActivityType } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const orange = 0xCCCCFF;

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setActivity('aha.exe | Pay $1 for cool perks!', { type: ActivityType.Playing });
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content.startsWith('!welcome')) {
    const embed = new EmbedBuilder()
      .setColor(PERIWINKLE)
      .setTitle('Welcome!')
      .setDescription(`Welcome to the server, ${message.author.username}!`)
      .setFooter({ text: 'Powered by Periwinkle Bot | aha.exe' });

    await message.channel.send({ embeds: [embed] });
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);

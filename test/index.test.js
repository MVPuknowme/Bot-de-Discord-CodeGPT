'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
    createBot,
    extractAgentPrompt,
    getBotConfig,
    isAllowedLocation,
    looksLikeCredential,
    parseIdSet,
    truncateDiscordReply
} = require('../index');

test('extracts agent requests only from the explicit prefix or bot mention', () => {
    assert.equal(extractAgentPrompt('!agent validate this mint', '12345'), 'validate this mint');
    assert.equal(extractAgentPrompt('<@12345> draft a lease inquiry', '12345'), 'draft a lease inquiry');
    assert.equal(extractAgentPrompt('<@!12345>: status', '12345'), 'status');
    assert.equal(extractAgentPrompt('ordinary server chat', '12345'), null);
});

test('detects submitted credentials without blocking ordinary security questions', () => {
    assert.equal(looksLikeCredential('What is a private key?'), false);
    assert.equal(looksLikeCredential('private key: super-secret-value'), true);
    assert.equal(looksLikeCredential(`OPENAI_API_KEY=sk-proj-${'a'.repeat(30)}`), true);
    assert.equal(looksLikeCredential(`[${Array.from({ length: 64 }, (_, index) => index).join(',')}]`), true);
});

test('applies optional guild and channel allowlists and disables DMs by default', () => {
    const config = getBotConfig({
        DISCORD_ALLOWED_GUILD_IDS: '12345,67890',
        DISCORD_AGENT_CHANNEL_IDS: '54321'
    });

    assert.deepEqual([...parseIdSet('12345, bad, 67890')], ['12345', '67890']);
    assert.equal(isAllowedLocation({ guildId: '12345', channelId: '54321' }, config), true);
    assert.equal(isAllowedLocation({ guildId: '12345', channelId: '99999' }, config), false);
    assert.equal(isAllowedLocation({ guildId: '11111', channelId: '54321' }, config), false);
    assert.equal(isAllowedLocation({ guildId: null, channelId: 'dm' }, config), false);
});

test('truncates agent output below the Discord message limit', () => {
    const result = truncateDiscordReply('x'.repeat(2_500));
    assert.ok(result.length <= 1_900);
    assert.match(result, /reply truncated$/);
});

test('routes a prefixed Discord request through the injected agent runtime', async () => {
    const prompts = [];
    const replies = [];
    const bot = createBot({
        env: {
            OPENAI_API_KEY: 'configured-for-test-only',
            AGENT_COOLDOWN_MS: '0'
        },
        agentRuntimeFactory: () => ({
            async run(prompt) {
                prompts.push(prompt);
                return 'Agent response with @everyone text.';
            }
        })
    });
    const messageHandler = bot.client.listeners('messageCreate')[0];

    await messageHandler({
        author: { bot: false, id: 'user-1', username: 'tester', tag: 'tester' },
        content: '!agent validate a public mint',
        guildId: '12345',
        channelId: '54321',
        channel: { async sendTyping() {} },
        async reply(payload) {
            replies.push(payload);
        }
    });

    assert.deepEqual(prompts, ['validate a public mint']);
    assert.equal(replies.length, 1);
    assert.equal(replies[0].content, 'Agent response with @everyone text.');
    assert.deepEqual(replies[0].allowedMentions, { parse: [], repliedUser: false });
});

test('blocks credential-like input before it reaches the agent', async () => {
    let runCount = 0;
    const replies = [];
    const bot = createBot({
        env: {
            OPENAI_API_KEY: 'configured-for-test-only',
            AGENT_COOLDOWN_MS: '0'
        },
        agentRuntimeFactory: () => ({
            async run() {
                runCount += 1;
                return 'should not run';
            }
        })
    });
    const messageHandler = bot.client.listeners('messageCreate')[0];

    await messageHandler({
        author: { bot: false, id: 'user-2', username: 'tester', tag: 'tester' },
        content: '!agent private key: do-not-process-this',
        guildId: '12345',
        channelId: '54321',
        channel: { async sendTyping() {} },
        async reply(payload) {
            replies.push(payload);
        }
    });

    assert.equal(runCount, 0);
    assert.match(replies[0].content, /will not process credentials/i);
});

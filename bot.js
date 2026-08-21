'use strict';

// Compatibility entrypoint for deployments that still execute `node bot.js`.
const { startBot } = require('./index');

startBot().catch((error) => {
    console.error('Bot startup failed.', {
        name: error && error.name,
        code: error && error.code,
        status: error && error.status
    });
    process.exitCode = 1;
});

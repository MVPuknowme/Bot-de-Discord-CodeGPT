'use strict';

const assert = require('node:assert/strict');
const { createOperationsAgentRuntime } = require('../src/agent');

const SAMPLE_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

async function main() {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is required for the agent smoke test.');
    }

    const rpcMethods = [];
    const fetchImpl = async (_url, options) => {
        const request = JSON.parse(options.body);
        rpcMethods.push(request.method);

        if (request.method !== 'getAccountInfo') {
            throw new Error('The smoke prompt should only request mint account information.');
        }

        return {
            ok: true,
            status: 200,
            async json() {
                return {
                    jsonrpc: '2.0',
                    id: request.id,
                    result: {
                        context: { slot: 300_000_000 },
                        value: {
                            owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
                            data: {
                                program: 'spl-token',
                                parsed: {
                                    type: 'mint',
                                    info: {
                                        decimals: 6,
                                        freezeAuthority: null,
                                        isInitialized: true,
                                        mintAuthority: null,
                                        supply: '1000000'
                                    }
                                },
                                space: 82
                            },
                            executable: false,
                            lamports: 1,
                            rentEpoch: 0,
                            space: 82
                        }
                    }
                };
            }
        };
    };

    const runtime = createOperationsAgentRuntime({
        fetchImpl,
        model: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
        rpcUrl: 'https://rpc.invalid.example',
        cluster: 'smoke-test'
    });

    const output = await runtime.run(
        `Use the Solana validation tool for mint ${SAMPLE_MINT} without an owner wallet. Summarize the result and its limitation.`,
        { timeoutMs: 45_000 }
    );

    assert.deepEqual(rpcMethods, ['getAccountInfo']);
    assert.ok(output.length > 0, 'The agent must return a final response.');
    console.log('Agent tool smoke test passed.');
    console.log(output);
}

main().catch((error) => {
    console.error('Agent tool smoke test failed.', {
        name: error && error.name,
        code: error && error.code,
        status: error && error.status
    });
    process.exitCode = 1;
});

'use strict';

const assert = require('node:assert/strict');
const {
    ScriptedModel,
    assistantMessage,
    functionCall
} = require('@openai/agents/testing');
const { createOperationsAgentRuntime } = require('../src/agent');

const SAMPLE_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

async function main() {
    const model = new ScriptedModel([
        [functionCall('validate_solana_game_token', {
            mintAddress: SAMPLE_MINT,
            ownerWallet: ''
        }, { callId: 'smoke-tool-call' })],
        [assistantMessage('Mint account confirmed by the mocked read-only RPC. This does not establish legitimacy or safety.')]
    ]);
    const rpcMethods = [];
    const fetchImpl = async (_url, options) => {
        const request = JSON.parse(options.body);
        rpcMethods.push(request.method);

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
                                }
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
        model,
        rpcUrl: 'https://rpc.invalid.example',
        cluster: 'smoke-test'
    });

    const output = await runtime.run(`Validate mint ${SAMPLE_MINT}.`);

    assert.deepEqual(rpcMethods, ['getAccountInfo']);
    assert.equal(model.calls.length, 2);
    assert.match(output, /does not establish legitimacy or safety/i);
    model.assertComplete();
    console.log('Offline Agents SDK tool-orchestration smoke test passed.');
    console.log(output);
}

main().catch((error) => {
    console.error('Offline agent smoke test failed.', {
        name: error && error.name,
        code: error && error.code
    });
    process.exitCode = 1;
});

'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
    SolanaValidationError,
    formatTokenAmount,
    isSolanaPublicKey,
    validateGameToken
} = require('../src/solana');

const SAMPLE_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const SAMPLE_OWNER = '11111111111111111111111111111111';

function jsonResponse(result) {
    return {
        ok: true,
        status: 200,
        async json() {
            return { jsonrpc: '2.0', id: 1, result };
        }
    };
}

function parsedMintAccount(overrides = {}) {
    return {
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
                    supply: '1234500',
                    ...overrides
                }
            },
            space: 82
        },
        executable: false,
        lamports: 1,
        rentEpoch: 0,
        space: 82
    };
}

function parsedTokenAccount(amount) {
    return {
        account: {
            data: {
                program: 'spl-token',
                parsed: {
                    type: 'account',
                    info: {
                        mint: SAMPLE_MINT,
                        tokenAmount: { amount }
                    }
                }
            }
        }
    };
}

test('validates Solana public-key encoding and exact byte length', () => {
    assert.equal(isSolanaPublicKey(SAMPLE_MINT), true);
    assert.equal(isSolanaPublicKey(SAMPLE_OWNER), true);
    assert.equal(isSolanaPublicKey('not-a-solana-address'), false);
    assert.equal(isSolanaPublicKey('O'.repeat(32)), false);
});

test('formats raw token amounts without floating-point loss', () => {
    assert.equal(formatTokenAmount('1234500', 6), '1.2345');
    assert.equal(formatTokenAmount('1', 9), '0.000000001');
    assert.equal(formatTokenAmount('100', 0), '100');
});

test('confirms a mint and totals an optional public owner balance', async () => {
    const methods = [];
    const fetchImpl = async (_url, options) => {
        const request = JSON.parse(options.body);
        methods.push(request.method);

        if (request.method === 'getAccountInfo') {
            return jsonResponse({
                context: { slot: 10 },
                value: parsedMintAccount()
            });
        }

        return jsonResponse({
            context: { slot: 11 },
            value: [parsedTokenAccount('100'), parsedTokenAccount('200')]
        });
    };

    const result = await validateGameToken({
        mintAddress: SAMPLE_MINT,
        ownerWallet: SAMPLE_OWNER,
        rpcUrl: 'https://rpc.example.test',
        fetchImpl
    });

    assert.deepEqual(methods, ['getAccountInfo', 'getTokenAccountsByOwner']);
    assert.equal(result.status, 'mint_account_confirmed');
    assert.equal(result.validated, true);
    assert.equal(result.supplyUi, '1.2345');
    assert.equal(result.ownerBalance.rawAmount, '300');
    assert.equal(result.ownerBalance.uiAmount, '0.0003');
    assert.equal(result.ownerBalance.hasPositiveBalance, true);
    assert.equal(result.ownerBalance.complete, true);
    assert.match(result.disclaimer, /not establish legitimacy/i);
});

test('fails closed when the mint account does not exist', async () => {
    const result = await validateGameToken({
        mintAddress: SAMPLE_MINT,
        rpcUrl: 'https://rpc.example.test',
        fetchImpl: async () => jsonResponse({ context: { slot: 12 }, value: null })
    });

    assert.equal(result.status, 'mint_not_found');
    assert.equal(result.validated, false);
    assert.equal(result.checks.accountExists, false);
});

test('fails closed for an account outside both supported token programs', async () => {
    const result = await validateGameToken({
        mintAddress: SAMPLE_MINT,
        rpcUrl: 'https://rpc.example.test',
        fetchImpl: async () => jsonResponse({
            context: { slot: 13 },
            value: {
                ...parsedMintAccount(),
                owner: '11111111111111111111111111111111'
            }
        })
    });

    assert.equal(result.status, 'not_a_supported_token_mint');
    assert.equal(result.validated, false);
    assert.equal(result.checks.supportedTokenProgram, false);
});

test('does not validate an uninitialized mint', async () => {
    const result = await validateGameToken({
        mintAddress: SAMPLE_MINT,
        rpcUrl: 'https://rpc.example.test',
        fetchImpl: async () => jsonResponse({
            context: { slot: 14 },
            value: parsedMintAccount({ isInitialized: false })
        })
    });

    assert.equal(result.status, 'mint_not_initialized');
    assert.equal(result.validated, false);
});

test('rejects malformed addresses before making an RPC request', async () => {
    let fetchCount = 0;

    await assert.rejects(
        validateGameToken({
            mintAddress: 'invalid',
            rpcUrl: 'https://rpc.example.test',
            fetchImpl: async () => {
                fetchCount += 1;
                return jsonResponse(null);
            }
        }),
        (error) => error instanceof SolanaValidationError && error.code === 'MINT_ADDRESS_INVALID'
    );

    assert.equal(fetchCount, 0);
});

test('returns a stable error code for RPC failures without exposing the endpoint', async () => {
    await assert.rejects(
        validateGameToken({
            mintAddress: SAMPLE_MINT,
            rpcUrl: 'https://rpc.example.test/private-key-in-url',
            fetchImpl: async () => {
                throw new Error('network failure at secret URL');
            }
        }),
        (error) => error instanceof SolanaValidationError
            && error.code === 'RPC_UNAVAILABLE'
            && !error.message.includes('private-key-in-url')
    );
});

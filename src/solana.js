'use strict';

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE58_INDEX = new Map([...BASE58_ALPHABET].map((character, index) => [character, index]));

const TOKEN_PROGRAMS = Object.freeze({
    TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: 'spl-token',
    TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb: 'spl-token-2022'
});
const MAX_U64 = 18_446_744_073_709_551_615n;

const VALIDATION_DISCLAIMER = [
    'This checks public on-chain account facts only.',
    'It does not establish legitimacy, safety, value, exchange support, or endorsement.',
    'No transaction was created or signed.'
].join(' ');

class SolanaValidationError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'SolanaValidationError';
        this.code = code;
    }
}

function decodeBase58(value) {
    if (typeof value !== 'string' || value.length === 0) {
        return null;
    }

    let numericValue = 0n;

    for (const character of value) {
        const digit = BASE58_INDEX.get(character);

        if (digit === undefined) {
            return null;
        }

        numericValue = (numericValue * 58n) + BigInt(digit);
    }

    const decoded = [];

    while (numericValue > 0n) {
        decoded.push(Number(numericValue & 0xffn));
        numericValue >>= 8n;
    }

    decoded.reverse();

    let leadingZeroCount = 0;

    while (value[leadingZeroCount] === '1') {
        leadingZeroCount += 1;
    }

    return Buffer.concat([
        Buffer.alloc(leadingZeroCount),
        Buffer.from(decoded)
    ]);
}

function isSolanaPublicKey(value) {
    if (typeof value !== 'string' || value.length < 32 || value.length > 44) {
        return false;
    }

    const decoded = decodeBase58(value);
    return decoded !== null && decoded.length === 32;
}

function normalizeRpcUrl(rpcUrl) {
    let parsed;

    try {
        parsed = new URL(rpcUrl);
    } catch {
        throw new SolanaValidationError('RPC_URL_INVALID', 'SOLANA_RPC_URL is not a valid URL.');
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new SolanaValidationError('RPC_URL_INVALID', 'SOLANA_RPC_URL must use HTTP or HTTPS.');
    }

    return parsed.toString();
}

async function rpcCall({
    rpcUrl,
    method,
    params,
    fetchImpl = globalThis.fetch,
    timeoutMs = 8_000
}) {
    if (typeof fetchImpl !== 'function') {
        throw new SolanaValidationError('RPC_FETCH_UNAVAILABLE', 'The runtime does not provide fetch.');
    }

    const endpoint = normalizeRpcUrl(rpcUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response;

    try {
        response = await fetchImpl(endpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method,
                params
            }),
            signal: controller.signal
        });
    } catch (error) {
        if (error && error.name === 'AbortError') {
            throw new SolanaValidationError('RPC_TIMEOUT', 'The Solana RPC request timed out.');
        }

        throw new SolanaValidationError('RPC_UNAVAILABLE', 'The Solana RPC request failed.');
    } finally {
        clearTimeout(timeout);
    }

    if (!response || response.ok !== true) {
        const status = Number.isInteger(response && response.status) ? ` (${response.status})` : '';
        throw new SolanaValidationError('RPC_HTTP_ERROR', `The Solana RPC returned an HTTP error${status}.`);
    }

    let payload;

    try {
        payload = await response.json();
    } catch {
        throw new SolanaValidationError('RPC_RESPONSE_INVALID', 'The Solana RPC returned invalid JSON.');
    }

    if (!payload || typeof payload !== 'object' || payload.error) {
        throw new SolanaValidationError('RPC_ERROR', 'The Solana RPC rejected the request.');
    }

    if (!Object.prototype.hasOwnProperty.call(payload, 'result')) {
        throw new SolanaValidationError('RPC_RESPONSE_INVALID', 'The Solana RPC response has no result.');
    }

    return payload.result;
}

function formatTokenAmount(rawAmount, decimals) {
    if (!isU64String(rawAmount) || !Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
        throw new SolanaValidationError('MINT_DATA_INVALID', 'The mint returned invalid token amount data.');
    }

    const normalized = rawAmount.replace(/^0+(?=\d)/, '');

    if (decimals === 0) {
        return normalized;
    }

    const padded = normalized.padStart(decimals + 1, '0');
    const whole = padded.slice(0, -decimals);
    const fraction = padded.slice(-decimals).replace(/0+$/, '');
    return fraction ? `${whole}.${fraction}` : whole;
}

function isU64String(value) {
    return typeof value === 'string'
        && /^\d{1,20}$/.test(value)
        && BigInt(value) <= MAX_U64;
}

function getParsedData(account) {
    if (!account || Array.isArray(account.data) || typeof account.data !== 'object') {
        return null;
    }

    return account.data.parsed && typeof account.data.parsed === 'object'
        ? account.data.parsed
        : null;
}

function getExtensionNames(info) {
    if (!Array.isArray(info.extensions)) {
        return [];
    }

    return info.extensions
        .slice(0, 20)
        .map((extension) => extension && (extension.extension || extension.type))
        .filter((name) => typeof name === 'string');
}

async function getOwnerBalance({ rpcUrl, mintAddress, ownerWallet, fetchImpl, timeoutMs }) {
    const result = await rpcCall({
        rpcUrl,
        method: 'getTokenAccountsByOwner',
        params: [
            ownerWallet,
            { mint: mintAddress },
            { encoding: 'jsonParsed', commitment: 'confirmed' }
        ],
        fetchImpl,
        timeoutMs
    });

    if (!result || !Array.isArray(result.value)) {
        throw new SolanaValidationError('OWNER_DATA_INVALID', 'The owner token-account response is invalid.');
    }

    let rawAmount = 0n;
    let parsedAccountCount = 0;

    for (const entry of result.value) {
        const parsed = getParsedData(entry && entry.account);
        const info = parsed && parsed.type === 'account' ? parsed.info : null;
        const amount = info && info.mint === mintAddress && info.tokenAmount
            ? info.tokenAmount.amount
            : null;

        if (!isU64String(amount)) {
            continue;
        }

        rawAmount += BigInt(amount);
        parsedAccountCount += 1;
    }

    return {
        wallet: ownerWallet,
        tokenAccountCount: result.value.length,
        parsedAccountCount,
        rawAmount: rawAmount.toString(),
        hasPositiveBalance: rawAmount > 0n,
        complete: parsedAccountCount === result.value.length,
        slot: Number.isInteger(result.context && result.context.slot) ? result.context.slot : null
    };
}

async function validateGameToken({
    mintAddress,
    ownerWallet,
    rpcUrl = 'https://api.mainnet-beta.solana.com',
    cluster = 'mainnet-beta',
    fetchImpl = globalThis.fetch,
    timeoutMs = 8_000
}) {
    if (!isSolanaPublicKey(mintAddress)) {
        throw new SolanaValidationError('MINT_ADDRESS_INVALID', 'The mint address is not a 32-byte Solana public key.');
    }

    if (ownerWallet && !isSolanaPublicKey(ownerWallet)) {
        throw new SolanaValidationError('OWNER_ADDRESS_INVALID', 'The owner wallet is not a 32-byte Solana public key.');
    }

    const result = await rpcCall({
        rpcUrl,
        method: 'getAccountInfo',
        params: [mintAddress, { encoding: 'jsonParsed', commitment: 'confirmed' }],
        fetchImpl,
        timeoutMs
    });

    const slot = Number.isInteger(result && result.context && result.context.slot)
        ? result.context.slot
        : null;
    const account = result && result.value;

    if (!account) {
        return {
            status: 'mint_not_found',
            validated: false,
            cluster,
            mintAddress,
            slot,
            checks: {
                addressFormat: true,
                accountExists: false,
                supportedTokenProgram: false,
                parsedAsMint: false,
                ownerBalanceChecked: false
            },
            disclaimer: VALIDATION_DISCLAIMER
        };
    }

    const program = TOKEN_PROGRAMS[account.owner];

    if (!program) {
        return {
            status: 'not_a_supported_token_mint',
            validated: false,
            cluster,
            mintAddress,
            slot,
            programOwner: account.owner || null,
            reason: 'The account is not owned by the original SPL Token Program or Token-2022 Program.',
            checks: {
                addressFormat: true,
                accountExists: true,
                supportedTokenProgram: false,
                parsedAsMint: false,
                ownerBalanceChecked: false
            },
            disclaimer: VALIDATION_DISCLAIMER
        };
    }

    const parsed = getParsedData(account);

    if (!parsed || parsed.type !== 'mint' || !parsed.info) {
        return {
            status: 'not_a_supported_token_mint',
            validated: false,
            cluster,
            mintAddress,
            slot,
            program,
            programOwner: account.owner,
            reason: 'The supported token program account could not be parsed as a mint.',
            checks: {
                addressFormat: true,
                accountExists: true,
                supportedTokenProgram: true,
                parsedAsMint: false,
                ownerBalanceChecked: false
            },
            disclaimer: VALIDATION_DISCLAIMER
        };
    }

    const info = parsed.info;

    if (!isU64String(info.supply)
        || !Number.isInteger(info.decimals) || typeof info.isInitialized !== 'boolean') {
        throw new SolanaValidationError('MINT_DATA_INVALID', 'The Solana RPC returned malformed mint data.');
    }

    let ownerBalance = null;

    if (ownerWallet) {
        ownerBalance = await getOwnerBalance({
            rpcUrl,
            mintAddress,
            ownerWallet,
            fetchImpl,
            timeoutMs
        });
        ownerBalance.uiAmount = formatTokenAmount(ownerBalance.rawAmount, info.decimals);
    }

    return {
        status: info.isInitialized ? 'mint_account_confirmed' : 'mint_not_initialized',
        validated: info.isInitialized,
        cluster,
        mintAddress,
        slot,
        program,
        programOwner: account.owner,
        initialized: info.isInitialized,
        decimals: info.decimals,
        supplyRaw: info.supply,
        supplyUi: formatTokenAmount(info.supply, info.decimals),
        mintAuthority: typeof info.mintAuthority === 'string' ? info.mintAuthority : null,
        freezeAuthority: typeof info.freezeAuthority === 'string' ? info.freezeAuthority : null,
        extensions: getExtensionNames(info),
        ownerBalance,
        checks: {
            addressFormat: true,
            accountExists: true,
            supportedTokenProgram: true,
            parsedAsMint: true,
            ownerBalanceChecked: Boolean(ownerWallet)
        },
        disclaimer: VALIDATION_DISCLAIMER
    };
}

module.exports = {
    SolanaValidationError,
    TOKEN_PROGRAMS,
    VALIDATION_DISCLAIMER,
    decodeBase58,
    formatTokenAmount,
    isSolanaPublicKey,
    rpcCall,
    validateGameToken
};

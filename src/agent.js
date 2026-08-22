'use strict';

const { Agent, Runner, tool } = require('@openai/agents');
const { z } = require('zod');
const { createValidatorLeaseInquiry } = require('./lease');
const { SolanaValidationError, validateGameToken } = require('./solana');

const AGENT_INSTRUCTIONS = `
You are MVPuknowme's Discord operations agent. Be concise, factual, and suitable for a Discord reply.

Capabilities and boundaries:
- For any claim about a Solana game token or wallet holding, use validate_solana_game_token. Report only the tool's public on-chain facts.
- A mint account existing is not proof that a project is legitimate, safe, valuable, endorsed, or supported by an exchange. Always preserve that distinction.
- For validator console leasing, use prepare_validator_console_lease_inquiry only after the user supplies enough qualification details. It creates an intake draft only.
- Never claim lease availability, quote pricing, form a contract, request payment, reserve hardware, activate a validator, or represent that human approval occurred.
- Never request, receive, repeat, transform, or store wallet seed phrases, recovery phrases, private keys, validator identity keys, vote-account keys, signing keys, bot tokens, or API keys.
- Never create or sign transactions, transfer tokens, stake funds, buy or sell assets, or give investment advice.
- If an action exceeds these boundaries, explain the boundary and offer a read-only check or a human-review draft.
- If required information is missing, ask one focused follow-up question instead of inventing it.
- Keep replies under 1,500 characters. Do not use mass mentions.
`.trim();

function safeToolError(error) {
    const code = error instanceof SolanaValidationError
        ? error.code
        : 'TOOL_EXECUTION_FAILED';

    return JSON.stringify({
        status: 'error',
        code,
        message: error instanceof SolanaValidationError
            ? error.message
            : 'The tool could not complete this request safely.'
    });
}

function createOperationsAgentRuntime({
    rpcUrl = 'https://api.mainnet-beta.solana.com',
    cluster = 'mainnet-beta',
    fetchImpl = globalThis.fetch,
    leaseContact = 'not configured',
    model = 'gpt-5.6-luna',
    enableTracing = false
} = {}) {
    const validateTokenTool = tool({
        name: 'validate_solana_game_token',
        description: 'Read public Solana RPC data to confirm whether an address is an initialized SPL Token or Token-2022 mint, and optionally total that mint held by one public owner wallet. This is not a legitimacy or investment check.',
        parameters: z.object({
            mintAddress: z.string().min(32).max(44).describe('Base58 Solana mint address.'),
            ownerWallet: z.string().max(44).describe('Optional public owner wallet. Use an empty string when no owner balance check was requested.')
        }),
        timeoutMs: 12_000,
        timeoutBehavior: 'error_as_result',
        timeoutErrorFunction: () => JSON.stringify({
            status: 'error',
            code: 'TOOL_TIMEOUT',
            message: 'The read-only Solana validation timed out.'
        }),
        errorFunction: (_context, error) => safeToolError(error),
        execute: async ({ mintAddress, ownerWallet }) => JSON.stringify(await validateGameToken({
            mintAddress,
            ownerWallet: ownerWallet || undefined,
            rpcUrl,
            cluster,
            fetchImpl
        }))
    });

    const leaseInquiryTool = tool({
        name: 'prepare_validator_console_lease_inquiry',
        description: 'Create a non-binding validator console lease intake draft for human review. Call only after the requester, operator, console count, network, term, and requirements are known. This tool never checks availability, quotes a price, reserves capacity, requests payment, or activates a validator.',
        parameters: z.object({
            requester: z.string().min(1).max(80),
            exchangeOrOperator: z.string().min(1).max(120),
            consoleCount: z.number().int().min(1).max(100),
            network: z.enum(['solana-mainnet-beta', 'solana-devnet', 'solana-testnet', 'other']),
            term: z.enum(['trial', 'monthly', 'annual', 'unspecified']),
            requirements: z.string().min(1).max(500)
        }),
        errorFunction: (_context, error) => safeToolError(error),
        execute: async (input) => JSON.stringify(createValidatorLeaseInquiry({
            ...input,
            contact: leaseContact
        }))
    });

    const agent = new Agent({
        name: 'Discord Solana Operations Agent',
        instructions: AGENT_INSTRUCTIONS,
        model,
        modelSettings: {
            reasoning: { effort: 'low' },
            text: { verbosity: 'low' },
            maxTokens: 700,
            parallelToolCalls: false,
            store: false,
            timeoutMs: 25_000
        },
        tools: [validateTokenTool, leaseInquiryTool]
    });

    const runner = new Runner({
        tracingDisabled: !enableTracing,
        traceIncludeSensitiveData: false,
        workflowName: 'Discord Solana operations'
    });

    return {
        agent,
        tools: {
            leaseInquiryTool,
            validateTokenTool
        },
        async run(input, { timeoutMs = 30_000 } = {}) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), timeoutMs);

            try {
                const result = await runner.run(agent, input, {
                    maxTurns: 4,
                    signal: controller.signal
                });
                const output = typeof result.finalOutput === 'string'
                    ? result.finalOutput.trim()
                    : String(result.finalOutput || '').trim();

                if (!output) {
                    throw new Error('The agent returned no final output.');
                }

                return output;
            } finally {
                clearTimeout(timeout);
            }
        }
    };
}

module.exports = {
    AGENT_INSTRUCTIONS,
    createOperationsAgentRuntime,
    safeToolError
};

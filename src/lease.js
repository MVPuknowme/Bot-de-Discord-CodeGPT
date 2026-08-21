'use strict';

const LEASE_NETWORKS = new Set([
    'solana-mainnet-beta',
    'solana-devnet',
    'solana-testnet',
    'other'
]);

const LEASE_TERMS = new Set(['trial', 'monthly', 'annual', 'unspecified']);

function normalizeText(value, fallback, maxLength) {
    if (typeof value !== 'string') {
        return fallback;
    }

    const normalized = value
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    return normalized ? normalized.slice(0, maxLength) : fallback;
}

function createValidatorLeaseInquiry({
    requester,
    exchangeOrOperator,
    consoleCount,
    network,
    term,
    requirements,
    contact
}) {
    if (!Number.isInteger(consoleCount) || consoleCount < 1 || consoleCount > 100) {
        throw new TypeError('consoleCount must be an integer from 1 through 100.');
    }

    if (!LEASE_NETWORKS.has(network)) {
        throw new TypeError('network is not supported.');
    }

    if (!LEASE_TERMS.has(term)) {
        throw new TypeError('term is not supported.');
    }

    return {
        status: 'draft_requires_human_approval',
        heading: 'Validator console lease inquiry',
        requester: normalizeText(requester, 'not provided', 80),
        exchangeOrOperator: normalizeText(exchangeOrOperator, 'not provided', 120),
        requestedConsoleCount: consoleCount,
        network,
        requestedTerm: term,
        requirements: normalizeText(requirements, 'not provided', 500),
        contact: normalizeText(contact, 'not configured', 160),
        availability: 'not checked',
        pricing: 'not quoted',
        contract: 'not created',
        payment: 'not requested',
        validatorActivation: 'not performed',
        humanReviewRequired: true,
        nextInformationNeeded: [
            'Operator identity and verification contact',
            'Region, uptime, monitoring, and support requirements',
            'Validator keys remain with the operator; never send keys or seed phrases',
            'Human approval of availability, pricing, terms, and compliance'
        ],
        disclaimer: 'This is intake only. It is not an offer, reservation, contract, invoice, validator activation, or financial recommendation.'
    };
}

function formatLeaseInquiry(inquiry) {
    return [
        '🖥️ **Validator console lease inquiry — draft only**',
        `Requester: ${inquiry.requester}`,
        `Exchange/operator: ${inquiry.exchangeOrOperator}`,
        `Consoles requested: ${inquiry.requestedConsoleCount}`,
        `Network: ${inquiry.network}`,
        `Term: ${inquiry.requestedTerm}`,
        `Requirements: ${inquiry.requirements}`,
        `Contact: ${inquiry.contact}`,
        'Availability and pricing: pending human review',
        'Never send validator keys, wallet private keys, or seed phrases.',
        inquiry.disclaimer
    ].join('\n');
}

module.exports = {
    LEASE_NETWORKS,
    LEASE_TERMS,
    createValidatorLeaseInquiry,
    formatLeaseInquiry,
    normalizeText
};

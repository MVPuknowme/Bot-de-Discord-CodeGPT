'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createValidatorLeaseInquiry, formatLeaseInquiry } = require('../src/lease');

test('creates only a human-review validator lease intake draft', () => {
    const inquiry = createValidatorLeaseInquiry({
        requester: 'operator-one',
        exchangeOrOperator: 'Example Exchange',
        consoleCount: 4,
        network: 'solana-mainnet-beta',
        term: 'monthly',
        requirements: 'US region, monitoring, and 24/7 alerting',
        contact: 'https://example.test/contact'
    });

    assert.equal(inquiry.status, 'draft_requires_human_approval');
    assert.equal(inquiry.requestedConsoleCount, 4);
    assert.equal(inquiry.availability, 'not checked');
    assert.equal(inquiry.pricing, 'not quoted');
    assert.equal(inquiry.contract, 'not created');
    assert.equal(inquiry.payment, 'not requested');
    assert.equal(inquiry.validatorActivation, 'not performed');
    assert.equal(inquiry.humanReviewRequired, true);
    assert.match(inquiry.disclaimer, /not an offer/i);
    assert.match(formatLeaseInquiry(inquiry), /Never send validator keys/i);
});

test('rejects console counts outside the intake boundary', () => {
    assert.throws(() => createValidatorLeaseInquiry({
        requester: 'operator-one',
        exchangeOrOperator: 'Example Exchange',
        consoleCount: 0,
        network: 'solana-mainnet-beta',
        term: 'monthly',
        requirements: 'none',
        contact: 'not configured'
    }), /consoleCount/);
});

test('normalizes control characters and caps untrusted intake text', () => {
    const inquiry = createValidatorLeaseInquiry({
        requester: 'operator\u0000one',
        exchangeOrOperator: 'Example\nExchange',
        consoleCount: 1,
        network: 'other',
        term: 'unspecified',
        requirements: 'x'.repeat(700),
        contact: 'not configured'
    });

    assert.equal(inquiry.requester, 'operator one');
    assert.equal(inquiry.exchangeOrOperator, 'Example Exchange');
    assert.equal(inquiry.requirements.length, 500);
});

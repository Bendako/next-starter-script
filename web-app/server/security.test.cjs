'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { canUseLegacyGenerator } = require('./security.cjs');

test('legacy generator is disabled by default', () => {
  assert.equal(canUseLegacyGenerator({}, '127.0.0.1'), false);
  assert.equal(canUseLegacyGenerator({ NODE_ENV: 'development' }, '::1'), false);
});

test('production cannot enable the unsafe legacy generator', () => {
  assert.equal(canUseLegacyGenerator({
    NODE_ENV: 'production',
    ALLOW_UNSAFE_LOCAL_GENERATOR: '1',
  }, '127.0.0.1'), false);
});

test('opt-in only works over the local loopback interface', () => {
  const env = { NODE_ENV: 'development', ALLOW_UNSAFE_LOCAL_GENERATOR: '1' };
  for (const ip of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) {
    assert.equal(canUseLegacyGenerator(env, ip), true);
  }
  for (const ip of ['0.0.0.0', '10.0.0.3', '192.168.1.3', '::ffff:10.0.0.3', undefined]) {
    assert.equal(canUseLegacyGenerator(env, ip), false);
  }
});

test('spelling mistakes cannot enable generator', () => {
  assert.equal(canUseLegacyGenerator({
    NODE_ENV: 'development',
    ALLOW_UNSAFE_LOCAL_GENERATOR: 'true',
  }, '127.0.0.1'), false);
});

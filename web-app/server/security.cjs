'use strict';

// The legacy Express generator trusts a userId from the request body.
// Until identity and quotas are validated server-side, never expose it publicly.
function canUseLegacyGenerator(env, remoteAddress) {
  return (
    env.NODE_ENV !== 'production' &&
    env.ALLOW_UNSAFE_LOCAL_GENERATOR === '1' &&
    ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remoteAddress)
  );
}

module.exports = { canUseLegacyGenerator };

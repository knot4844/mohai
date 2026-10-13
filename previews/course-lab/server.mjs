// The preview port serves the same application and API as production.
process.env.PORT='4182';
process.env.MOHAI_PROXY_PRODUCTION='true';
await import('../../server.mjs');

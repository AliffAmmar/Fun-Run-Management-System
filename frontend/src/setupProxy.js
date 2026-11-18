// Dev server only (react-scripts loads this automatically): forwards /api/* to the backend, so the
// browser talks to ONE address. That lets a phone open the site via the laptop's network address
// (e.g. http://172.20.10.5:3000) or a tunnel, without also reaching the backend port, and without CORS.
//
// Backend address: BACKEND_URL, or http://localhost:<BACKEND_PORT> (default 5000), from frontend/.env.
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function setupProxy(app) {
  const target = process.env.BACKEND_URL || `http://localhost:${process.env.BACKEND_PORT || 5000}`;
  app.use(createProxyMiddleware('/api', { target, changeOrigin: true, logLevel: 'warn' }));
};

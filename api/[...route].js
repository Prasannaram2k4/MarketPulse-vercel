const appPromise = import('../marketpulse-pro/backend/app.js');

module.exports = async function handler(req, res) {
  try {
    const { default: app } = await appPromise;
    return app(req, res);
  } catch (error) {
    console.error('API request failed:', error);
    if (!res.headersSent) {
      return res.status(503).json({ message: 'API is unavailable. Check the deployment configuration.' });
    }
  }
};

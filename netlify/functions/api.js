// Netlify function wrapper for Express app
const serverless = require('serverless-http');
const path = require('path');

const app = require('../../server.js');

// For local development, just start the server
if (require.main === module) {
  const ensureDb = require('../../server.js').ensureDb;
  ensureDb().then(() => {
    app.listen(process.env.PORT || 3000, () => {
      console.log(`Server running on port ${process.env.PORT || 3000}`);
    });
  });
}

// Serverless handler
exports.handler = async (event, context) => {
  // Ensure database is initialized before handling request
  await app.ensureDb();
  const handler = serverless(app);
  return handler(event, context);
};
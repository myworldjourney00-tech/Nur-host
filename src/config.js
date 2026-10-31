require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: process.env.JWT_SECRET || 'nur-host-super-secret-key-123456789',
  APP_BASE_URL: process.env.APP_BASE_URL || 'http://localhost:3000',
  GITHUB: {
    TOKEN: process.env.GITHUB_TOKEN,
    OWNER: process.env.GITHUB_OWNER,
    REPO: process.env.GITHUB_REPO,
    API_URL: 'https://api.github.com'
  }
};

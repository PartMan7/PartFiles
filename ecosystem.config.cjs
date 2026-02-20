module.exports = {
  apps: [{
    name: 'partfiles',
    script: 'server.js',
    node_args: '-r dotenv/config',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      HOSTNAME: '0.0.0.0',
    },
  }],
};

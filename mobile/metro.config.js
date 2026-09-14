const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Use Node's built-in file crawler to bypass Watchman hangs
config.resolver.useWatchman = false;

module.exports = config;

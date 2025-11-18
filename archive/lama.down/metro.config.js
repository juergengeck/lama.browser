// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Set app root for expo-router with absolute path
process.env.EXPO_ROUTER_APP_ROOT = path.resolve(__dirname, 'app');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

module.exports = config;

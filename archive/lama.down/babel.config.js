module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src',
            '@components': './src/components',
            '@hooks': './src/hooks',
            '@transport': './src/transport',
            '@screens': './src/screens',
            '@utils': './src/utils',
            '@storage': './src/storage',
            '@src': './src',
            '@lama/ui': '../lama.ui/src',
            '@refinio/one.core': '../packages/one.core.expo',
            '@refinio/one.models': '../packages/one.models',
            '@chat/core': '../chat.core',
            '@lama/core': '../lama.core',
            '@lama/connection.core': '../connection.core',
            '@settings/core': '../settings.core',
            '@mcp/core': '../mcp.core',
          },
          extensions: [
            '.ios.ts',
            '.android.ts',
            '.ts',
            '.ios.tsx',
            '.android.tsx',
            '.tsx',
            '.jsx',
            '.js',
            '.json',
          ],
        },
      ],
      // 'nativewind/babel', // Temporarily disabled for debugging
    ],
  };
};

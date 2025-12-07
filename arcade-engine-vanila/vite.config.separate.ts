import { defineConfig, BuildOptions } from 'vite';
import defaultConfig from './vite.config';

/**
 * Defines the custom build options for separating chunks.
 * This logic is responsible for creating separate files for the engine,
 * the game registry, and individual games.
 */
const separateBuildOptions: { build: BuildOptions } = {
  build: {
    // Use 'terser' to gain fine-grained control over the output
    minify: 'terser',
    terserOptions: {
      // Disable compression to prevent code structure changes
      compress: false,
      // Disable name mangling to keep original variable and function names
      mangle: false,
      // Keep comments and format the code to be readable
      format: { beautify: true, comments: true },
    },
    rollupOptions: {
      // Prevent specified packages from being bundled
      external: [
        'react',
        'react-dom',
        'three',
        'rxjs'
      ],
      output: {
        // Place main entry file in dist root, e.g., dist/index.js
        entryFileNames: `[name].js`,
        // Place asset files like CSS in dist root
        assetFileNames: `[name].[ext]`,
        // Custom logic for chunk file names
        manualChunks: (id: string) => {
          // Separate the engine code into its own chunk.
          if (id.includes('/src/engine/')) {
            return 'engine';
          }
          // Separate the game registry code into its own chunk.
          if (id.includes('src/GameRegistry')) {
            return 'game-registry';
          }
        },
        chunkFileNames: (chunkInfo) => {
          // If the chunk is a game (based on the dynamic import path), place it in the 'games' folder
          if (chunkInfo.facadeModuleId?.includes('/src/games/')) {
            return 'games/[name].js';
          }
          return '[name].js';
        },
      },
    },
  },
};

// This configuration is for the 'separate' build.
// It starts with the default config, then merges the custom chunking logic.
export default defineConfig(() => {
  // The defaultConfig is an object, not a function, so we use it directly.
  const baseConfig = defaultConfig;
  
  // Merge the base config with the separate build options
  // We need to deep merge the 'build' property to preserve all options
  const mergedBuildOptions = {
    ...baseConfig.build,
    ...separateBuildOptions.build,
  };

  return {
    ...baseConfig,
    build: mergedBuildOptions,
  };
});
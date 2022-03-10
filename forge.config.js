module.exports = {
  packagerConfig: {},
  makers:
    [
      { name: '@electron-forge/maker-zip', platforms: ['linux'] },
      { name: '@electron-forge/maker-deb', config: {} },
      { name: '@electron-forge/maker-rpm', config: {} }
    ],
  plugins:
    [
      [
        '@electron-forge/plugin-webpack',
        {
          devContentSecurityPolicy: `\
${`default-src 'self' 'unsafe-eval' 'unsafe-inline' data:;`}\
${`script-src 'self' 'unsafe-eval' 'unsafe-inline' data:;`}\
${`script-src-elem 'self' 'unsafe-eval' 'unsafe-inline' unpkg.com *.unpkg.com data:;`}\
`,
          devServer: { 'liveReload': false },
          mainConfig: './webpack.main.config.js',
          renderer: {
            nodeIntegration: true,
            config: './webpack.renderer.config.js',
            entryPoints: [{
              html: './src/index.html',
              js: './src/renderer.ts',
              name: 'main_window'
            }]
          }
        }
      ],
      PatchedForgeExternalsPlugin({
        includeDeps: true,
        externals:
          [
            'apache-arrow',
            '@rapidsai/core', '@rapidsai/cuda', '@rapidsai/cudf',
            '@rapidsai/cugraph', '@rapidsai/cuml', '@rapidsai/cuspatial',
            '@rapidsai/deck.gl', '@rapidsai/glfw', '@rapidsai/io',
            '@rapidsai/jsdom', '@rapidsai/rmm', '@rapidsai/sql', '@rapidsai/webgl',
            'wrtc'
          ]
      })
    ]
};

function PatchedForgeExternalsPlugin(opts) {

  const ForgeExternalsPlugin = require('@timfish/forge-externals-plugin');
  const { Walker, DepType } = require('flora-colossus');
  const { dirname } = require('path');

  return Object.assign(
    new ForgeExternalsPlugin(opts),
    {
      resolveForgeConfig: async (forgeConfig) => {
        const foundModules = new Set(this._externals);

        if (this._includeDeps) {
          for (const external of this._externals) {
            const moduleRoot = dirname(
              require.resolve(`${external}/package.json`, { paths: [this._dir] })
            );

            const walker = new Walker(moduleRoot);
            // These are private so it's quite nasty!
            walker.modules = [];
            await walker.walkDependenciesForModule(moduleRoot, DepType.PROD);
            walker.modules
              .filter((dep) => dep.nativeModuleType === DepType.PROD)
              .map((dep) => dep.name)
              .forEach((name) => foundModules.add(name));
          }
        }

        // The webpack plugin already sets the ignore function.
        const existingIgnoreFn = forgeConfig.packagerConfig.ignore;

        // We override it and ensure we include external modules too
        forgeConfig.packagerConfig.ignore = (file) => {
          const existingResult = existingIgnoreFn(file);

          if (existingResult == false) {
            return false;
          }

          if (file === "/node_modules") {
            return false;
          }

          for (const module of foundModules) {
            if (file.startsWith(`/node_modules/${module}`)) {
              return false;
            }
            if (file.startsWith(`/node_modules/${module.split('/')[0]}`)) {
              return false;
            }
          }

          return true;
        };

        return forgeConfig;
      }
    });
}

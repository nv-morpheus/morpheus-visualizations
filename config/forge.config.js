module.exports = {
  packagerConfig: {},
  makers: [
    // {name: '@electron-forge/maker-zip', platforms: ['linux']},
    // {name: '@electron-forge/maker-deb', config: {}},
    {name: 'electron-forge-maker-appimage', config: {}},
    // { name: '@electron-forge/maker-rpm', config: {} }
  ],
  plugins: [[
    '@electron-forge/plugin-webpack',
    {
      devContentSecurityPolicy: `\
${`default-src 'self' 'unsafe-eval' 'unsafe-inline' data:;`}\
${`script-src 'self' 'unsafe-eval' 'unsafe-inline' data:;`}\
${`script-src-elem 'self' 'unsafe-eval' 'unsafe-inline' unpkg.com *.unpkg.com data:;`}\
`,
      devServer: {'liveReload': false},
      mainConfig: './config/webpack.main.config.js',
      renderer: {
        nodeIntegration: true,
        config: './config/webpack.renderer.config.js',
        entryPoints: [
          {
            html: './src/index.html',
            js: './src/renderer.ts',
            name: 'main_window',
          },
        ]
      }
    }
  ]]
};

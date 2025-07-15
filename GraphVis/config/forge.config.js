const makers = [];

if (process.env.MAKE_DEB === '1') {
  makers.push({ name: '@electron-forge/maker-deb', config: {} });
}
if (process.env.MAKE_APPIMAGE === '1') {
  makers.push({ name: 'electron-forge-maker-appimage', config: {} });
}
if (process.env.MAKE_RPM === '1') {
  makers.push({ name: '@electron-forge/maker-rpm', config: {} });
}
if (process.env.MAKE_ZIP === '1' || makers.length === 0) {
  makers.push({ name: '@electron-forge/maker-zip', platforms: ['linux'] });
}

module.exports = {
  packagerConfig: {},
  makers,
  plugins: [{
    name: '@electron-forge/plugin-webpack',
    config: {
      devContentSecurityPolicy: `\
${`default-src 'self' 'unsafe-eval' 'unsafe-inline' data:;`}\
${`script-src 'self' 'unsafe-eval' 'unsafe-inline' data:;`}\
${`script-src-elem 'self' 'unsafe-eval' 'unsafe-inline' unpkg.com *.unpkg.com data:;`}\
`,
      devServer: { 'liveReload': false },
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
  }]
};

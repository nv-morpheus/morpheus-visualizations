const rules = require('./webpack.rules');
const plugins = require('./webpack.plugins');
const externals = { ...require('./webpack.externals') };

for (const key in externals) {
  externals[key] = `require("${externals[key]}")`;
}

rules.push({
  test: /\.css$/,
  use: [{ loader: 'style-loader' }, { loader: 'css-loader' }],
});

module.exports = {
  module: {
    rules,
  },
  plugins,
  externals,
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
  },
};

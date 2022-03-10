module.exports = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  entry: './src/index.ts',
  // Put your normal webpack config below here
  module: {
    rules: require('./webpack.rules'),
  },
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.json'],
  },
  externals: {
    'apache-arrow': 'apache-arrow',
    '@rapidsai/core': '@rapidsai/core',
    '@rapidsai/cuda': '@rapidsai/cuda',
    '@rapidsai/cudf': '@rapidsai/cudf',
    '@rapidsai/cudf/build/js/scalar': '@rapidsai/cudf/build/js/scalar',
    '@rapidsai/cugraph': '@rapidsai/cugraph',
    '@rapidsai/cuml': '@rapidsai/cuml',
    '@rapidsai/cuspatial': '@rapidsai/cuspatial',
    '@rapidsai/deck.gl': '@rapidsai/deck.gl',
    '@rapidsai/glfw': '@rapidsai/glfw',
    '@rapidsai/io': '@rapidsai/io',
    '@rapidsai/jsdom': '@rapidsai/jsdom',
    '@rapidsai/rmm': '@rapidsai/rmm',
    '@rapidsai/sql': '@rapidsai/sql',
    '@rapidsai/webgl': '@rapidsai/webgl',
    'wrtc': 'wrtc',
  },
};

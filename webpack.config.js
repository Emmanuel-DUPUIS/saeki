const path = require('path');
const webpack = require('webpack');

module.exports = {
  mode: 'development',
  entry: './src/index.js',
  experiments: {
    asyncWebAssembly: true
  },
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist'),
  },
    plugins: [
      new webpack.ProvidePlugin({
             process: 'process/browser.js',
      }),
  ],
  
  module: {
    noParse: /\/node_modules\/process\//,
    rules: [
      {
        test: /\.wasm$/,
        type: "javascript/auto",
        loader: "file-loader"
      }
    ]
  }
};



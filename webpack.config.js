const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const webpack = require('webpack');

module.exports = {
  entry: {
    main: './index.js'
  },
  output: {
    filename: '[name].[contentHash].bundle.js'
  },
  module: {
    rules: [
      {
        test: /\.worklet.js$/,
        use: {
          loader: 'raw-loader',
        }
      },
      {
        test: /\.js$/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
          }
        }
      },
      {
        test: /\.vgm$/i,
        use: [
          {
            loader: 'file-loader',
          },
        ],
      },
    ]
  },
  plugins: [
    new webpack.ProgressPlugin(),
    new CleanWebpackPlugin(),
    new HtmlWebpackPlugin({
      title: 'test',
      meta: {
        viewport: "width=device-width, user-scalable=no",
      }
    }),
  ],
};

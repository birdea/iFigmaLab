const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { ModuleFederationPlugin } = require('@module-federation/enhanced/webpack');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

module.exports = (env, argv) => {
  const isProd = argv.mode === 'production' || process.env.NODE_ENV === 'production';

  return {
    entry: './src/index.ts',
    mode: isProd ? 'production' : 'development',
    // hidden-source-map: .map 파일 생성하지만 번들에서 참조하지 않아 소스 노출 방지
    devtool: isProd ? 'hidden-source-map' : 'eval-cheap-module-source-map',
    devServer: {
      port: parseInt(process.env.FRONTEND_PORT || '3005', 10),
      host: '0.0.0.0',
      allowedHosts: 'all',
      headers: {
        // 개발 환경 전용 — 프로덕션은 public/_headers 파일로 관리
        "Access-Control-Allow-Origin": "*",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      }
    },
    output: {
      publicPath: 'auto',
      path: path.resolve(__dirname, 'dist'),
      filename: isProd ? '[name].[contenthash].js' : '[name].js',
      chunkFilename: isProd ? '[name].[contenthash].chunk.js' : '[name].chunk.js',
      clean: true,
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          loader: 'ts-loader',
          exclude: /node_modules/,
          options: { transpileOnly: true }
        },
        {
          test: /\.md$/,
          type: 'asset/source',
        },
        {
          test: /\.(css|s[ac]ss)$/i,
          use: [
            isProd ? MiniCssExtractPlugin.loader : 'style-loader',
            {
              loader: 'css-loader',
              options: {
                modules: {
                  namedExport: false,
                  auto: true,
                  localIdentName: '[name]__[local]--[hash:base64:5]'
                }
              }
            },
            'sass-loader'
          ]
        }
      ]
    },
    plugins: [
      new webpack.DefinePlugin({
        'process.env.PROXY_URL': JSON.stringify(process.env.PROXY_URL || 'http://localhost:3006'),
        'process.env.FIGMA_MCP_URL': JSON.stringify(process.env.FIGMA_MCP_URL || 'http://localhost:3845'),
        'process.env.NODE_ENV': JSON.stringify(isProd ? 'production' : 'development'),
        'process.env.SYSTEM_PROMPT': JSON.stringify(process.env.SYSTEM_PROMPT ?? undefined),
        'process.env.MAX_OUTPUT_TOKENS': JSON.stringify(process.env.MAX_OUTPUT_TOKENS ?? undefined),
        'process.env.APP_VERSION': JSON.stringify(require('./package.json').version),
      }),
      ...(isProd ? [new MiniCssExtractPlugin({ filename: '[name].[contenthash].css' })] : []),
      new ModuleFederationPlugin({
        name: 'figmalab',
        filename: 'remoteEntry.js',
        exposes: {
          './FigmaLabApp': './src/App'
        },
        shared: {
          react: { singleton: true, requiredVersion: '^19.0.0' },
          'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
          jotai: { singleton: true, requiredVersion: '^2.11.0' }
        }
      }),
      new HtmlWebpackPlugin({
        template: './public/index.html'
      }),
      new ForkTsCheckerWebpackPlugin()
    ]
  };
};

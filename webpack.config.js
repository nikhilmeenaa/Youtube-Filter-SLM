const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
    mode: 'development',
    entry: {
        popup: './popup.js',
        content: './content.js',
        background: './background.js',
        'transformers-loader': './transformers-loader.js'
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js',
        clean: true
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env']
                    }
                }
            }
        ]
    },
    plugins: [
        new CopyWebpackPlugin({
            patterns: [
                { from: 'manifest.json', to: 'manifest.json' },
                { from: 'popup.html', to: 'popup.html' },
                { from: 'popup.css', to: 'popup.css' },
                { from: 'content.css', to: 'content.css' },
                { from: 'icons', to: 'icons', noErrorOnMissing: true },
                { from: 'README.md', to: 'README.md', noErrorOnMissing: true }
            ]
        })
    ],
    resolve: {
        fallback: {
            "path": require.resolve("path-browserify"),
            "fs": false,
            "crypto": require.resolve("crypto-browserify"),
            "stream": require.resolve("stream-browserify"),
            "buffer": require.resolve("buffer")
        }
    },
    // Remove externals - we'll load transformers.js directly in the content script
    optimization: {
        minimize: false // Keep readable for debugging
    }
}; 
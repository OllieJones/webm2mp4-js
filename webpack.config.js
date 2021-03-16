const path = require('path')

module.exports = {
  mode: 'development',
  devtool: 'source-map',
  entry: {
    mediatransboxer: './src/mediatransboxer.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist')
  },
  resolve: {
    fallback: {
      stream: require.resolve('stream-browserify'),
      buffer: require.resolve('buffer/')
    }
  }
}

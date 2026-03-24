const path = require('path')

module.exports = {
  publicPath: './',
  outputDir: 'dist',
  assetsDir: '',
  productionSourceMap: false,
  filenameHashing: false,
  chainWebpack: (config) => {
    config.plugin('html').tap((args) => {
      args[0].template = path.resolve(__dirname, 'index.html')
      return args
    })
  },
  configureWebpack: {
    watchOptions: {
      ignored: [path.resolve(__dirname, 'src/data')],
    },
  },
}

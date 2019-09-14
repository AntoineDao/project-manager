const { serverless } = require('@probot/serverless-lambda')
const appFn = require('./app')

module.exports.probot = serverless(appFn)
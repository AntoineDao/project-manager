const handlers = require('./lib/handlers');

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Application} app
 */
module.exports = app => {
  // Your code here
  app.log('Yay, the app was loaded!')
  app.log(process.env);

  // Get an express router to expose new HTTP endpoints
  const router = app.route('/project-manager')
  // Use any middleware
  router.use(require('express').static('public'))

  app.on(['issues.opened', 'pull_request.opened'], handlers.handleToggledIssue)

  app.on(['issues.closed', 'pull_request.closed'], handlers.handleToggledIssue)

  app.on(['issues.labeled', 'pull_request.labeled'], handlers.handleLabelledIssue)

}

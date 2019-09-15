const probot = require('./probot');

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Application} app
 */
module.exports = app => {
  app.log('project-manager was loaded!')

  app.on(['issues.opened', 'pull_request.opened'], probot.handleToggledIssue)

  app.on(['issues.closed', 'pull_request.closed'], probot.handleToggledIssue)

  app.on(['issues.labeled', 'pull_request.labeled'], probot.handleLabelledIssue)

}

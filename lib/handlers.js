const getConfig = require('probot-config')
const graphQlQueries = require('./graphql');
const projectInteractions = require('./tasks/projects');
const actions = require('./actions');
const labels = require('./tasks/addLabels');

const configFile = 'project-manager.yml';

module.exports.handleToggledIssue = async context => {
  const config = await getConfig(context, configFile)
  const { payload, github } = context;
  const org = payload.repository.owner.login;
  const repo = payload.repository.name;
  const { action } = payload;

  let issue;
  let tasks = {};

  switch (context.name) {
    case 'pull_request':
      issue = payload.pull_request;
      if (config.pull_request && config.pull_request[action]) {
        tasks = config.pull_request[action]
      }
      break;
    case 'issues':
      issue = payload.issue;
      if (config.issue && config.issue[action]) {
        tasks = config.issue[action]
      }
      break;
    default:
      return new Error('This function can only handle pull_request or issues events.')
  }
  
  await labels.checkLabels(context, org, repo, config)
  
  return actions.apply(context, issue, tasks, github)
};

module.exports.handleLabelledIssue = async context => {
  const { payload, github } = context;
  const { label } = payload;
  const config = await getConfig(context, configFile)
  const org = payload.repository.owner.login;
  const repo = payload.repository.name;
  let issueNumber;
  let issue;

  switch (context.name) {
    case 'pull_request':
      issue = payload.pull_request;
      issueNumber = payload.number;
      break;
    case 'issues':
      issue = payload.issue;
      issueNumber = payload.issue.number;
      break;
    default:
      return new Error('This function can only handle pull_request or issues events.')
  }


  const queryData = await github.query(
    graphQlQueries.getProjectsForIssue,
    {
      login: org,
      repo,
      issue: issueNumber
    }
  );

  let targetColumns = [];

  try {
    targetColumns = await projectInteractions.labelledIssueToColumns(context, config, label.name, queryData);
  } catch (err) {
    console.log(err)
    return Promise.reject(err);
  }

  try {
    await Promise.all(targetColumns.map(col => { 
      if(col.actions) {
        return actions.apply(context, issue, col.actions, github)
      }
      return Promise.resolve()
    }))
  } catch (err) {
    console.log(err)
    return Promise.reject(err)
  }
  
  await labels.checkLabels(context, org, repo, config)
  
  return Promise.resolve();
}
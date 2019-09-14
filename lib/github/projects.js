const _ = require('lodash');
const graphQlQueries = require('./graphql');

Array.prototype.diffString = function (a) {
  const b = a.map(str => str);
  return this.map(str => str).filter(function (i) { return b.indexOf(i) < 0; });
};

const createMissingProjects = (projects, existingProjects, github, org, repo) => {
  return projects.map(project => {
    const projectMatch = existingProjects.filter(p => p.name == project.name).pop();

    if (!projectMatch) {
      if (project.type == 'org') {
        return github.projects.createForOrg({ org, name: project.name })
          .then(res => {const p = res.data;  p.columns = []; p.type = project.type; return p; })
      } else if (project.type == 'repo') {
        return github.projects.createForRepo({ owner: org, repo, name: project.name })
          .then(res => {const p = res.data;  p.columns = []; p.type = project.type; return p; })
      } else {
        console.log("Can't create project without a valid type")
        return null;
      }
    }

    projectMatch.columns = projectMatch.columns.nodes;
    return projectMatch;
  })
}

const createMissingColumns = (projects, existingProjects, github) => (
  projects.map(async project => {
    const projectMatch = existingProjects.filter(p => p.name == project.name).pop();

    const missingColumns = project.columns.map(col => col.name)
      .diffString(projectMatch.columns.map(col => col.name));

    const newColumns = await Promise.all(missingColumns.map(name => {
      return github.projects.createColumn({ project_id: projectMatch.id, name })
        .then(res => res.data);
    }));

    projectMatch.columns = projectMatch.columns.concat(newColumns);

    return projectMatch;
  })
);

module.exports.getOrCreateProjects = async (projects, queryProjects, org, repo, github) => {
  const orgProjects = queryProjects.org.projects.nodes.filter(p => !p.closed);
  const repoProjects = queryProjects.repo.projects.nodes.filter(p => !p.closed);

  let existingProjects = orgProjects.map(project => { project.type = 'org'; return project })
    .concat(repoProjects.map(project => { project.type = 'repo'; return project }))

  existingProjects = await Promise.all(createMissingProjects(projects, existingProjects, github, org, repo))

  existingProjects = await Promise.all(createMissingColumns(projects, existingProjects, github))

  return existingProjects;
};

const issueMatchesProject = (project, issue) => {
  const issueLabels = issue.labels.nodes.map(l => l.name);
  return (!project.label || issueLabels.includes(project.label)) 
      && (!project.issue_type || _.camelCase(project.issue_type) == _.camelCase(issue.type))
}

const targetColumnsFromLabel = (label, issue, configProjects, projects) => {
  const targetColumns = configProjects.map(cp => {
    if (issueMatchesProject(cp, issue)) {
      const columns = cp.columns.filter(col => col.labels && col.labels.includes(label));
      if (columns.length > 1) {
        console.log('Cannot have more than one target column, review label filter config.')
        return null;
      } else if (columns.length == 0) {
        return null;
      }

      const project = projects.filter(p => p.name === cp.name).pop()
      const column = project.columns.filter(c => c.name == columns[0].name).pop();
      return {
        project,
        column,
        actions: columns[0].actions
      }
    }

    return null;
  });

  return targetColumns.filter(tc => tc !== null);
}

// const targetColumnsFrom

module.exports.labelledIssueToColumns = async (context, config, label, queryData ) => {
  const { payload, github } = context;
  const queryIssue = queryData.repo.issue;
  const configProjects = config.projects;
  const org = payload.repository.owner.login;
  const repo = payload.repository.name;
  const projects = await this.getOrCreateProjects(configProjects, queryData, org, repo, github);
  const targetColumns = targetColumnsFromLabel(label, queryIssue, configProjects, projects);

  if (targetColumns.length !== 0) {
    await github.query(graphQlQueries.moveProjectCards(queryIssue, targetColumns));
  }

  return targetColumns;
};
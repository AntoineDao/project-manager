const _ = require('lodash');

module.exports.getProjectsForIssue = 
  `fragment ProjectData on Project {
    node_id: id
    id: databaseId
    name
    closed
    columns(first: 10) {
      nodes {
        name
        node_id: id
        id: databaseId
      }
    }
  }

  fragment IssueData on IssueOrPullRequest {
    type: __typename
    ... on Issue {
      node_id: id
      id: databaseId
      labels(first: 10) {
        nodes {
          node_id: id
          name
          color
        }
      }
      projectCards(first: 10) {
        nodes {
          node_id: id
          id: databaseId
          project {
            name
            number
            id: databaseId
            node_id: id
          }
        }
      }
    }
    ... on PullRequest {
      node_id: id
      id: databaseId
      labels(first: 10) {
        nodes {
          node_id: id
          name
          color
        }
      }
      projectCards(first: 10) {
        nodes {
          node_id: id
          id: databaseId
          project {
            name
            number
            id: databaseId
            node_id: id
          }
        }
      }
    }
  }

  query ProjectsAndIssue($login: String!, $repo: String!, $issue: Int!) {
    org: organization(login: $login) {
      projects(first: 10) {
        nodes {
          ...ProjectData
        }
      }
    }
    repo: repository(owner: $login, name: $repo) {
      issue: issueOrPullRequest(number: $issue) {
        ...IssueData
      }
      projects(first: 10) {
        nodes {
          ...ProjectData
        }
      }
    }
  }`;

module.exports.getProjectsForRepo =
  `fragment ProjectData on Project {
    id
    databaseId
    name
    closed
    columns(first: 10) {
      nodes {
        name
        id
        databaseId
      }
    }
  }

  query ProjectsAndIssue($login: String!, $repo: String!) {
    org: organization(login: $login) {  
      projects(first: 10) {
        nodes {
        ...ProjectData
        }
      }
    }
    repo: repository(owner: $login, name: $repo) {
        projectCards(first:10) {
          nodes {
            project {
              name
              number
              databaseId
            }
          }
        }
      }
      projects(first: 10) {
        nodes {
        ...ProjectData
        }
      }
    }
  }`;

module.exports.createColumns = (projectId, columns) => {
  const mutations = columns.map(col => (
    `
    ${_.camelCase(col.name)}: addProjectColumn(input:{name: "${col.name}", projectId: "${projectId}"}){
      columnEdge{
        node {
          id
          databaseId
          name
          project {
            id
            databaseId
            name
          }
        }
      }
    }`
  ));

  return `mutation { ${mutations.join()} }`
};

module.exports.getProjects = async (context, config) => {
  let orgLogin = null;
  let orgQuery = "";
  let repoQuery = "";
  if (context.payload.organization) {
    orgLogin = context.payload.organization.login
  }

  if (config.projects.org) {
    orgQuery = `org: organization(login: "${orgLogin}") {
      projects(first: 10) {
        nodes {
        ...ProjectData
        }
      }
    }`
  }

  if (config.projects.repo) {
    const login = context.payload.repository.owner.login;
    const name = context.payload.repository.name;
    repoQuery = `repo: repository(owner: "${login}", name: "${name}") {
      projects(first: 10) {
        nodes {
        ...ProjectData
        }
      }
    }`
  }

  const projectsQuery = `fragment ProjectData on Project {
    id
    databaseId
    name
    columns(first: 10) {
      nodes {
        name
        id
        databaseId
      }
    }
  }
  {
    ${orgQuery}
    ${repoQuery}
  }`;

  const data = await context.github.query(projectsQuery);
  
  return data;
}

module.exports.removeLabels = (issue, labels) => {
  const issueId = issue.node_id;
  const labelIds = labels.map(l => {
    let label = issue.labels.filter(il => il.name == l).pop();
    if (label) {
      return label.node_id
    }
    return null;
  }).filter(l => l !== null);

  if (labelIds.length === 0) {
    return null
  }

  return `mutation {
    removeLabelsFromLabelable(input: {labelIds: ${JSON.stringify(labelIds)}, labelableId: "${issueId}"}){
    labelable {
      type: __typename
      }
    }
  }
  `
}

module.exports.getLabels = `
  query getLabels($login: String!, $repo: String!) {
    repo: repository(owner:$login, name: $repo) {
      node_id: id
      labels(first: 50) {
        nodes {
          id
          name
          color
          description
        }
      }
    }
  }`

module.exports.moveProjectCards = (issue, targetColumns) => {
  const mutations = targetColumns.map(target => {
    const existingCard = issue.projectCards.nodes.filter(c => c.project.node_id === target.project.node_id).pop();
    const uniqueProjectName = _.camelCase(`${target.project.type} ${target.project.name}`);
    if (!existingCard) {
      return `
        ${uniqueProjectName}: addProjectCard(input: {projectColumnId: "${target.column.node_id}" contentId:"${issue.node_id}"}) {
        cardEdge {
          node {
            id
            column {
              name
            }
            project {
              name
            }
            note
          }
        }
      }
      `
    }

    return `
      ${uniqueProjectName}: moveProjectCard(input: {columnId: "${target.column.node_id}" cardId:"${existingCard.node_id}"}) {
      cardEdge {
        node {
          id
          column {
            name
          }
          project {
            name
          }
          note
        }
      }
    }
    `
  });
  
  return `mutation {
    ${mutations.join()}
  }
  `
};
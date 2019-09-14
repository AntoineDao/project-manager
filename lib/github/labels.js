const _ = require('lodash');
const graphQlQueries = require('./graphql');

module.exports.openedLabels = async (context, config) => {
  const labels = [];
  labels.push(config.issues.all.labels);
  labels.push(config.issues.opened.labels);
  return context.github.issues.addLabels(
    context.issue({ labels })
  );
};

module.exports.closedLabels = async (context, config) => {
  const labels = [];
  labels.push(config.issues.all.labels);
  labels.push(config.issues.closed.labels);
  return context.github.issues.addLabels(
    context.issue({ labels })
  );
};

module.exports.checkLabels = async (context, org, repo, config) => {
  const desiredLabels = config.labels;
  const queryData = await context.github.query(
    graphQlQueries.getLabels,
    {
      login: org,
      repo
    }
  );

  const currentLabels = queryData.repo.labels.nodes;
  const requests = desiredLabels.map(l => {
    let color = "ededed";

    if (l.color) {
      color = l.color;
      while (color.charAt(0) === '#') {
        color = color.substr(1);
      }
    }

    let labelMatch;
    labelMatch = currentLabels.filter(ql => ql.name === l.oldName).pop();
    if (!labelMatch) {
      labelMatch = currentLabels.filter(ql => ql.name === l.name).pop();
    }
    const labelPayload = {
      owner: org,
      repo,
      current_name: l.name,
      name: l.name,
      color: color,
      description: l.description
    }

    if (!labelMatch) {
      return context.github.issues.createLabel(labelPayload);
    }

    // if (labelMatch.description !== l.description || labelMatch.color !== color) {
    //   return context.github.issues.updateLabel(labelPayload); 
    // }
    
    // For some reason the API won't update descriptions at the moment...
    if (labelMatch.color !== color) {
      return context.github.issues.updateLabel(labelPayload);
    }

    return Promise.resolve();
  })

  return Promise.all(requests);
}
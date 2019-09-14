const graphQlQueries = require('./github/graphql');

module.exports.apply = async (context, issue, actions, github) => {
  const mutations = Object.keys(actions).map(action => {
    switch (action) {
      case 'removeLabels':
        const mutation = graphQlQueries.removeLabels(issue, actions[action]);
        if (mutation) {
          return github.query(mutation)
        }
        return Promise.resolve();
      case 'addLabels':
        const currentLabels = issue.labels.map(l => l.name);
        const newLabels = actions[action].filter(l => !currentLabels.includes(l));
        return github.issues.addLabels(
          context.issue({ labels: newLabels })
          );
      default:
        return null;
    }
  }).filter(a => a !== null);

  return Promise.all(mutations);
}
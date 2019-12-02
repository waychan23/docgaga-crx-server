const { Signale } = require('signale');

const logger = new Signale({
  stream: process.stdout,
  types: {
    error: {
      stream: [process.stdout, process.stderr]
    }
  }
});

logger.config({
  displayFilename: true,
  displayTimestamp: true,
  displayDate: true,
  displayBadge: false
});

module.exports = logger;
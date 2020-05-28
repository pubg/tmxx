const tmux = require('./tmux');

const yargs = require('yargs')
  .usage('Usage: $0 <session-file>')
  .help('h')
  .option('debug', { alias: 'd' })
  .alias('h', 'help');

const argv = yargs.argv

if (!argv._[0]) {
  yargs.showHelp();
} else {
  tmux.launch(argv._[0], argv.debug);
}

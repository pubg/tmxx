const fs = require('fs')
const child_process = require('child_process')
const jsyaml = require('js-yaml')

class Executor {
  constructor(debug) {
    this.debug = debug;
  }

  exec(cmd) {
    if (this.debug) {
      console.log(`${cmd}`);
    } else {
      child_process.execSync(cmd);
    }  
  }

  spawn(cmd, args, options) {
    if (this.debug) {
      console.log(`${cmd} ${args.join(' ')}`);
    } else {
      child_process.spawnSync(cmd, args, options);
    }
  }
}

let _idx = 0
class TreeNode {
  constructor({ type, parent, commands, share, title, executor }) {
    this.idx = _idx
    this.type = type
    this.share = share
    this.parent = parent || null
    this.commands = commands || null
    this.children = []
    this.built = []
    this.title = title || ( commands && commands[0] ) || 'no title'
    this.executor = executor;

    if (type == 'window') {
      _idx ++
    }
  }

  split() {
    if (this.children.length == 0) {
      return
    }

    const total = this.children.reduce((sum, node) => sum + node.share, 0)

    this.built.push(this.children[0])
    let allocated = 0

    for (let i=1 ;i<this.children.length; ++i) {
      const direction_flag = this.type == 'vstack' ? '-v' : '-h'
      const percent = Math.floor(100 - this.children[i - 1].share / (total - allocated) * 100)
      // console.log(`>>> ${allocated}:${total} ${Math.floor(this.children[i-1].share/total*100)} ${percent}`)
      
      this.executor.exec(`tmux splitw ${direction_flag} -p ${percent}`)
      // this.executor.exec(`tmux send-keys "echo ${percent} ${direction_flag} -p ${percent}" C-m`)
      
      allocated += this.children[i - 1].share
      this.built.push(this.children[i])
    }
  }

  create_children() {
    for (const node of this.built) {
      // const pane_number = this.find_root().find_window_number(node.id)
      this.executor.exec(`tmux select-pane -t ${node.idx}`);
      this.executor.exec(`tmux select-pane -T '${node.title} - title'`);

      if (node.type != 'window') {
        node.create()
      }
    }
  }

  create() {
    this.split()
    this.create_children()
  }

  run() {
    if (this.type === 'window') {
      this.executor.exec(`tmux select-pane -t ${this.idx}`)
      this.commands.forEach(c => this.executor.exec(`tmux send-keys "${c}" C-m`))
      console.log('')
    }
    this.built.forEach(node => node.run())
  }

  debug(indent = '') {
    console.log(`# ${indent}${this.type} ${this.id} [${this.idx}]  share: ${this.share} - ${this.commands && this.commands.join('; ')}`)
    for (const node of this.children) {
      node.debug(`${indent}  `)
    }
  }
}

function layout(executor, conf, parent) {
  if (typeof conf === 'string') {
    return new TreeNode({ executor, title: conf.title, type: 'window', parent, commands: [ conf ], share: 1 })
  }
  if (conf.command) {
    if (typeof conf.command === 'string') {
      return new TreeNode({ executor, title: conf.title, type: 'window', parent, commands: [ conf.command ], share: conf.share || 1 })
    }
    return new TreeNode({ executor, title: conf.title, type: 'window', parent, commands: conf.command, share: conf.share || 1 })
  }
  const node = new TreeNode({ executor, title: conf.title, type: conf.vstack ? 'vstack' : 'hstack', parent, share: conf.share || 1 })
  node.children = (conf.vstack || conf.hstack).map(conf => layout(executor, conf))

  return node
}

function launch(confpath, debug) {
  const conf = jsyaml.load(fs.readFileSync(confpath, 'utf8'))
  const executor = new Executor(debug);
  
  executor.exec(`tmux start-server`)
  executor.exec(`tmux new-session -d -s '${conf.name}' -x ${process.stdout.columns} -y ${process.stdout.rows}`)
  executor.exec(`tmux set pane-border-status bottom`)
  executor.exec(`tmux set pane-border-format "#{pane_index} #T"`)

  const root = layout(executor, conf);
  root.debug();
  root.create();
  root.run();

  executor.spawn('tmux', [ 'attach-session', '-t', conf.name ], {
    stdio: 'inherit'
  });
}

module.exports = { launch }

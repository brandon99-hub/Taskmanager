module.exports = {
  apps: [{
    name: 'taskmanager-api',
    script: 'npm',
    args: 'start',
    env: {
      NODE_ENV: 'production',
      SESSION_SECRET: '4bcfde8256c33f12a829971c71f75aad1070038497480c7930a8932e1ceadc24e32453208cdeef4c356118f7a2f3e977f88ea06472bce20d780df8540ed6a8fa'
    },
    cwd: '/var/www/taskmanager/Taskmanager'
  }]
}

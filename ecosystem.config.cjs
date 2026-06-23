const fs = require('node:fs')
const path = require('node:path')

function loadEnvFile(filePath) {
  const env = {}
  if (!fs.existsSync(filePath))
    return env

  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#'))
      continue
    const separator = trimmed.indexOf('=')
    if (separator === -1)
      continue
    const key = trimmed.slice(0, separator).trim()
    const value = trimmed.slice(separator + 1).trim()
    if (key)
      env[key] = value
  }
  return env
}

const root = __dirname
const env = {
  NODE_ENV: 'production',
  ...loadEnvFile(path.join(root, '.env.local')),
}

module.exports = {
  apps: [
    {
      name: 'video-flow-web',
      cwd: root,
      script: 'node_modules/next/dist/bin/next',
      args: 'start --hostname 0.0.0.0 --port 3000',
      interpreter: 'node',
      env,
      max_restarts: 10,
      restart_delay: 3000,
    },
    {
      name: 'video-flow-ws',
      cwd: root,
      script: 'node_modules/tsx/dist/cli.mjs',
      args: 'server/workflow-sync-server.ts',
      interpreter: 'node',
      env,
      max_restarts: 10,
      restart_delay: 3000,
    },
  ],
}

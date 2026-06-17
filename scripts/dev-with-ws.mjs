import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

function loadEnvLocal() {
  const envPath = path.join(root, '.env.local')
  try {
    const content = readFileSync(envPath, 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#'))
        continue
      const separator = trimmed.indexOf('=')
      if (separator === -1)
        continue
      const key = trimmed.slice(0, separator).trim()
      const value = trimmed.slice(separator + 1).trim()
      if (key && process.env[key] === undefined)
        process.env[key] = value
    }
  }
  catch {
    // .env.local is optional until first-time setup
  }
}

loadEnvLocal()

function run(name, command, args) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  })

  child.on('exit', (code, signal) => {
    if (signal) {
      console.log(`[dev] ${name} exited via ${signal}`)
      process.exit(1)
    }
    if (code && code !== 0) {
      console.log(`[dev] ${name} exited with code ${code}`)
      process.exit(code)
    }
  })

  return child
}

const ws = run('workflow-sync', 'pnpm', ['exec', 'tsx', 'server/workflow-sync-server.ts'])
const next = run('next', 'pnpm', ['exec', 'next', 'dev', '--hostname', '0.0.0.0'])

function shutdown() {
  ws.kill('SIGTERM')
  next.kill('SIGTERM')
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

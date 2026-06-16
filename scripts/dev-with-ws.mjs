import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

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
const next = run('next', 'pnpm', ['exec', 'next', 'dev'])

function shutdown() {
  ws.kill('SIGTERM')
  next.kill('SIGTERM')
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

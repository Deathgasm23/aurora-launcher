import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { LogEntry } from '../../shared/types'

const LOG_FILE = 'launcher.log'
const MAX_LOG_SIZE = 5 * 1024 * 1024

export class LogsService {
  private logPath: string
  private logs: LogEntry[] = []

  constructor(dataDir?: string) {
    this.logPath = path.join(dataDir || app.getPath('userData'), LOG_FILE)
    this.loadExisting()
  }

  private loadExisting() {
    try {
      if (!fs.existsSync(this.logPath)) return
      const stat = fs.statSync(this.logPath)
      if (stat.size > MAX_LOG_SIZE) {
        fs.renameSync(this.logPath, this.logPath + '.old')
        return
      }
      const data = fs.readFileSync(this.logPath, 'utf-8')
      this.logs = data.trim().split('\n').slice(-500).map(line => {
        try { return JSON.parse(line) } catch { return null }
      }).filter(Boolean) as LogEntry[]
    } catch {
      this.logs = []
    }
  }

  add(level: LogEntry['level'], message: string, source: string) {
    const entry: LogEntry = { timestamp: Date.now(), level, message, source }
    this.logs.push(entry)
    if (this.logs.length > 1000) this.logs = this.logs.slice(-500)
    this.appendToFile(entry)
  }

  private appendToFile(entry: LogEntry) {
    try {
      const dir = path.dirname(this.logPath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.appendFileSync(this.logPath, JSON.stringify(entry) + '\n', 'utf-8')
    } catch {}
  }

  getLogs(): LogEntry[] {
    return [...this.logs]
  }

  clear() {
    this.logs = []
    try {
      if (fs.existsSync(this.logPath)) fs.unlinkSync(this.logPath)
    } catch {}
  }
}

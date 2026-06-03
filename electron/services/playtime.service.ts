import * as fs from 'fs'
import * as path from 'path'
import { PlaySession, PlaytimeData } from '../../shared/types'

const PLAY_TIME_FILE = 'playtime.json'
const MAX_SESSIONS = 100

export class PlaytimeService {
  private filePath: string
  private sessions: PlaySession[] = []

  constructor(dataDir?: string) {
    const userDataPath = dataDir || require('electron').app.getPath('userData')
    this.filePath = path.join(userDataPath, PLAY_TIME_FILE)
    this.load()
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        this.sessions = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'))
      }
    } catch {
      this.sessions = []
    }
  }

  private save(): void {
    try {
      const dir = path.dirname(this.filePath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(this.filePath, JSON.stringify(this.sessions, null, 2), 'utf-8')
    } catch (err) {
      console.error('Failed to save playtime:', err)
    }
  }

  recordSession(accountId: string, accountName: string, versionId: string, startTime: number, duration: number): void {
    this.sessions.push({
      accountId,
      accountName,
      versionId,
      startTime,
      duration: Math.round(duration / 1000),
    })
    if (this.sessions.length > MAX_SESSIONS) {
      this.sessions = this.sessions.slice(-MAX_SESSIONS)
    }
    this.save()
  }

  getStats(): PlaytimeData {
    const byVersion: Record<string, { count: number; totalDuration: number }> = {}
    const byAccount: Record<string, { count: number; totalDuration: number; lastPlayed: number }> = {}
    let totalPlayed = 0

    for (const s of this.sessions) {
      totalPlayed += s.duration

      if (!byVersion[s.versionId]) byVersion[s.versionId] = { count: 0, totalDuration: 0 }
      byVersion[s.versionId].count++
      byVersion[s.versionId].totalDuration += s.duration

      if (!byAccount[s.accountId]) byAccount[s.accountId] = { count: 0, totalDuration: 0, lastPlayed: 0 }
      byAccount[s.accountId].count++
      byAccount[s.accountId].totalDuration += s.duration
      if (s.startTime > byAccount[s.accountId].lastPlayed) {
        byAccount[s.accountId].lastPlayed = s.startTime
      }
    }

    return {
      totalPlayed,
      byVersion,
      byAccount,
      lastSessions: [...this.sessions].reverse().slice(0, 10),
    }
  }
}

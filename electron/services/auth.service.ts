import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { MinecraftAccount } from '../../shared/types'

const ACCOUNTS_FILE = 'accounts.json'
const ALGORITHM = 'aes-256-gcm'

interface AccountsData {
  version: number
  accounts: MinecraftAccount[]
  currentAccountId: string | null
}

export class AuthService {
  private accountsPath: string
  private accounts: MinecraftAccount[] = []
  private currentAccountId: string | null = null
  private encryptionKey: Buffer

  constructor(dataDir?: string) {
    const userDataPath = dataDir || app.getPath('userData')
    this.accountsPath = path.join(userDataPath, ACCOUNTS_FILE)
    this.encryptionKey = this.getOrCreateEncryptionKey(userDataPath)
    this.loadAccounts()
  }

  private getOrCreateEncryptionKey(userDataPath: string): Buffer {
    const keyFile = path.join(userDataPath, '.encryption_key')
    try {
      if (fs.existsSync(keyFile)) return fs.readFileSync(keyFile)
      const key = crypto.randomBytes(32)
      if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath, { recursive: true })
      fs.writeFileSync(keyFile, key)
      return key
    } catch {
      return crypto.randomBytes(32)
    }
  }

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(ALGORITHM, this.encryptionKey, iv)
    let enc = cipher.update(text, 'utf-8', 'hex')
    enc += cipher.final('hex')
    return iv.toString('hex') + ':' + cipher.getAuthTag().toString('hex') + ':' + enc
  }

  private decrypt(encryptedText: string): string {
    try {
      const parts = encryptedText.split(':')
      if (parts.length !== 3) return encryptedText
      const decipher = crypto.createDecipheriv(ALGORITHM, this.encryptionKey, Buffer.from(parts[0], 'hex'))
      decipher.setAuthTag(Buffer.from(parts[1], 'hex'))
      let dec = decipher.update(parts[2], 'hex', 'utf-8')
      dec += decipher.final('utf-8')
      return dec
    } catch {
      return encryptedText
    }
  }

  private migrateData(data: any): AccountsData {
    if (data.version === undefined) {
      return {
        version: 1,
        accounts: data.accounts || [],
        currentAccountId: data.currentAccountId || null,
      }
    }
    return data
  }

  private loadAccounts(): void {
    try {
      if (fs.existsSync(this.accountsPath)) {
        const raw = JSON.parse(fs.readFileSync(this.accountsPath, 'utf-8'))
        const data = this.migrateData(raw)
        this.accounts = data.accounts || []
        this.currentAccountId = data.currentAccountId || null
        for (const acc of this.accounts) {
          if (acc.accessToken) acc.accessToken = this.decrypt(acc.accessToken)
          if (acc.refreshToken) acc.refreshToken = this.decrypt(acc.refreshToken)
        }
      }
    } catch {
      this.accounts = []
      this.currentAccountId = null
    }
  }

  private saveAccounts(): void {
    try {
      const accountsToSave = this.accounts.map(acc => ({
        ...acc,
        accessToken: acc.accessToken ? this.encrypt(acc.accessToken) : undefined,
        refreshToken: acc.refreshToken ? this.encrypt(acc.refreshToken) : undefined,
      }))
      const dir = path.dirname(this.accountsPath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(this.accountsPath, JSON.stringify({
        version: 1,
        accounts: accountsToSave,
        currentAccountId: this.currentAccountId,
      } as AccountsData, null, 2), 'utf-8')
    } catch (err) {
      console.error('Failed to save accounts:', err)
    }
  }

  async loginOffline(username: string): Promise<{ success: boolean; account?: MinecraftAccount; error?: string }> {
    if (!username || username.trim().length === 0) {
      return { success: false, error: 'Username cannot be empty' }
    }
    if (username.length > 16) {
      return { success: false, error: 'Username must be 16 characters or less' }
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return { success: false, error: 'Username can only contain letters, numbers, and underscores' }
    }

    const accountId = crypto.randomUUID()
    const account: MinecraftAccount = {
      id: accountId,
      username: username.trim(),
      uuid: this.offlineUUID(username.trim()),
      type: 'offline',
      lastUsed: Date.now(),
    }

    this.accounts.push(account)
    this.currentAccountId = account.id
    this.saveAccounts()

    return { success: true, account }
  }

  offlineUUID(username: string): string {
    const hash = crypto.createHash('md5').update('OfflinePlayer:' + username).digest('hex')
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`
  }

  getAccounts(): MinecraftAccount[] {
    return [...this.accounts]
  }

  getCurrentAccount(): MinecraftAccount | null {
    if (!this.currentAccountId) return null
    return this.accounts.find(a => a.id === this.currentAccountId) || null
  }

  setCurrentAccount(accountId: string): void {
    if (this.accounts.find(a => a.id === accountId)) {
      this.currentAccountId = accountId
      const account = this.accounts.find(a => a.id === accountId)
      if (account) account.lastUsed = Date.now()
      this.saveAccounts()
    }
  }

  removeAccount(accountId: string): void {
    this.accounts = this.accounts.filter(a => a.id !== accountId)
    if (this.currentAccountId === accountId) {
      this.currentAccountId = this.accounts.length > 0 ? this.accounts[0].id : null
    }
    this.saveAccounts()
  }
}

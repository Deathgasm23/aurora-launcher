"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const ACCOUNTS_FILE = 'accounts.json';
const ALGORITHM = 'aes-256-gcm';
class AuthService {
    constructor(dataDir) {
        this.accounts = [];
        this.currentAccountId = null;
        const userDataPath = dataDir || electron_1.app.getPath('userData');
        this.accountsPath = path.join(userDataPath, ACCOUNTS_FILE);
        this.encryptionKey = this.getOrCreateEncryptionKey(userDataPath);
        this.loadAccounts();
    }
    getOrCreateEncryptionKey(userDataPath) {
        const keyFile = path.join(userDataPath, '.encryption_key');
        try {
            if (fs.existsSync(keyFile))
                return fs.readFileSync(keyFile);
            const key = crypto.randomBytes(32);
            if (!fs.existsSync(userDataPath))
                fs.mkdirSync(userDataPath, { recursive: true });
            fs.writeFileSync(keyFile, key);
            return key;
        }
        catch {
            return crypto.randomBytes(32);
        }
    }
    encrypt(text) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(ALGORITHM, this.encryptionKey, iv);
        let enc = cipher.update(text, 'utf-8', 'hex');
        enc += cipher.final('hex');
        return iv.toString('hex') + ':' + cipher.getAuthTag().toString('hex') + ':' + enc;
    }
    decrypt(encryptedText) {
        try {
            const parts = encryptedText.split(':');
            if (parts.length !== 3)
                return encryptedText;
            const decipher = crypto.createDecipheriv(ALGORITHM, this.encryptionKey, Buffer.from(parts[0], 'hex'));
            decipher.setAuthTag(Buffer.from(parts[1], 'hex'));
            let dec = decipher.update(parts[2], 'hex', 'utf-8');
            dec += decipher.final('utf-8');
            return dec;
        }
        catch {
            return encryptedText;
        }
    }
    migrateData(data) {
        if (data.version === undefined) {
            return {
                version: 1,
                accounts: data.accounts || [],
                currentAccountId: data.currentAccountId || null,
            };
        }
        return data;
    }
    loadAccounts() {
        try {
            if (fs.existsSync(this.accountsPath)) {
                const raw = JSON.parse(fs.readFileSync(this.accountsPath, 'utf-8'));
                const data = this.migrateData(raw);
                this.accounts = data.accounts || [];
                this.currentAccountId = data.currentAccountId || null;
                for (const acc of this.accounts) {
                    if (acc.accessToken)
                        acc.accessToken = this.decrypt(acc.accessToken);
                    if (acc.refreshToken)
                        acc.refreshToken = this.decrypt(acc.refreshToken);
                }
            }
        }
        catch {
            this.accounts = [];
            this.currentAccountId = null;
        }
    }
    saveAccounts() {
        try {
            const accountsToSave = this.accounts.map(acc => ({
                ...acc,
                accessToken: acc.accessToken ? this.encrypt(acc.accessToken) : undefined,
                refreshToken: acc.refreshToken ? this.encrypt(acc.refreshToken) : undefined,
            }));
            const dir = path.dirname(this.accountsPath);
            if (!fs.existsSync(dir))
                fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(this.accountsPath, JSON.stringify({
                version: 1,
                accounts: accountsToSave,
                currentAccountId: this.currentAccountId,
            }, null, 2), 'utf-8');
        }
        catch (err) {
            console.error('Failed to save accounts:', err);
        }
    }
    async loginOffline(username) {
        if (!username || username.trim().length === 0) {
            return { success: false, error: 'Username cannot be empty' };
        }
        if (username.length > 16) {
            return { success: false, error: 'Username must be 16 characters or less' };
        }
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            return { success: false, error: 'Username can only contain letters, numbers, and underscores' };
        }
        const accountId = crypto.randomUUID();
        const account = {
            id: accountId,
            username: username.trim(),
            uuid: this.offlineUUID(username.trim()),
            type: 'offline',
            lastUsed: Date.now(),
        };
        this.accounts.push(account);
        this.currentAccountId = account.id;
        this.saveAccounts();
        return { success: true, account };
    }
    offlineUUID(username) {
        const hash = crypto.createHash('md5').update('OfflinePlayer:' + username).digest('hex');
        return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
    }
    getAccounts() {
        return [...this.accounts];
    }
    getCurrentAccount() {
        if (!this.currentAccountId)
            return null;
        return this.accounts.find(a => a.id === this.currentAccountId) || null;
    }
    setCurrentAccount(accountId) {
        if (this.accounts.find(a => a.id === accountId)) {
            this.currentAccountId = accountId;
            const account = this.accounts.find(a => a.id === accountId);
            if (account)
                account.lastUsed = Date.now();
            this.saveAccounts();
        }
    }
    removeAccount(accountId) {
        this.accounts = this.accounts.filter(a => a.id !== accountId);
        if (this.currentAccountId === accountId) {
            this.currentAccountId = this.accounts.length > 0 ? this.accounts[0].id : null;
        }
        this.saveAccounts();
    }
}
exports.AuthService = AuthService;

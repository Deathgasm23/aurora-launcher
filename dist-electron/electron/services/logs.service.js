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
exports.LogsService = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const LOG_FILE = 'launcher.log';
const MAX_LOG_SIZE = 5 * 1024 * 1024;
class LogsService {
    constructor(dataDir) {
        this.logs = [];
        this.logPath = path.join(dataDir || electron_1.app.getPath('userData'), LOG_FILE);
        this.loadExisting();
    }
    loadExisting() {
        try {
            if (!fs.existsSync(this.logPath))
                return;
            const stat = fs.statSync(this.logPath);
            if (stat.size > MAX_LOG_SIZE) {
                fs.renameSync(this.logPath, this.logPath + '.old');
                return;
            }
            const data = fs.readFileSync(this.logPath, 'utf-8');
            this.logs = data.trim().split('\n').slice(-500).map(line => {
                try {
                    return JSON.parse(line);
                }
                catch {
                    return null;
                }
            }).filter(Boolean);
        }
        catch {
            this.logs = [];
        }
    }
    add(level, message, source) {
        const entry = { timestamp: Date.now(), level, message, source };
        this.logs.push(entry);
        if (this.logs.length > 1000)
            this.logs = this.logs.slice(-500);
        this.appendToFile(entry);
    }
    appendToFile(entry) {
        try {
            const dir = path.dirname(this.logPath);
            if (!fs.existsSync(dir))
                fs.mkdirSync(dir, { recursive: true });
            fs.appendFileSync(this.logPath, JSON.stringify(entry) + '\n', 'utf-8');
        }
        catch { }
    }
    getLogs() {
        return [...this.logs];
    }
    clear() {
        this.logs = [];
        try {
            if (fs.existsSync(this.logPath))
                fs.unlinkSync(this.logPath);
        }
        catch { }
    }
}
exports.LogsService = LogsService;

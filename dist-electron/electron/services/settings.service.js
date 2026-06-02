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
exports.SettingsService = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const SETTINGS_FILE = 'settings.json';
class SettingsService {
    constructor(dataDir) {
        const userDataPath = dataDir || electron_1.app.getPath('userData');
        this.settingsPath = path.join(userDataPath, SETTINGS_FILE);
        this.settings = this.getDefaults();
        this.load();
    }
    getDefaults() {
        return {
            minecraftDirectory: path.join(electron_1.app.getPath('home'), '.aurora-launcher', 'minecraft'),
            javaPath: '',
            minMemory: 1024,
            maxMemory: 4096,
            javaArgs: '-XX:+UseG1GC -XX:-UseAdaptiveSizePolicy -XX:-OmitStackTraceInFastThrow -Dfml.ignoreInvalidMinecraftCertificates=true -Dfml.ignorePatchDiscrepancies=true',
            width: 854,
            height: 480,
            fullscreen: false,
            theme: 'dark',
            accentColor: '#d97706',
            launchArgs: '',
            versionMemory: {},
        };
    }
    load() {
        try {
            if (fs.existsSync(this.settingsPath)) {
                const parsed = JSON.parse(fs.readFileSync(this.settingsPath, 'utf-8'));
                this.settings = { ...this.getDefaults(), ...parsed };
            }
        }
        catch {
            this.settings = this.getDefaults();
        }
    }
    save() {
        try {
            const dir = path.dirname(this.settingsPath);
            if (!fs.existsSync(dir))
                fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf-8');
        }
        catch (err) {
            console.error('Failed to save settings:', err);
        }
    }
    getSettingsPath() {
        return this.settingsPath;
    }
    get() {
        return { ...this.settings };
    }
    update(partial) {
        this.settings = { ...this.settings, ...partial };
        this.save();
        return this.get();
    }
    reset() {
        this.settings = this.getDefaults();
        this.save();
        return this.get();
    }
}
exports.SettingsService = SettingsService;

import { AESKEY_DEFAULT, DB_FILE_PATH, DOWNLOAD_DIR, GARMIN_USERNAME_DEFAULT } from '../constant';
import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';

const CryptoJS = require('crypto-js');

const GARMIN_USERNAME = process.env.GARMIN_USERNAME ?? GARMIN_USERNAME_DEFAULT;
const AESKEY = process.env.AESKEY ?? AESKEY_DEFAULT;

export const initDB = async () => {
    const db = await getDB();
    await db.exec(`CREATE TABLE IF NOT EXISTS garmin_session (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user VARCHAR(20),
            region VARCHAR(20),
            session  TEXT
        )`);

    // Table to track synced activities (for resilience)
    await db.exec(`CREATE TABLE IF NOT EXISTS synced_activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            activity_id VARCHAR(50) UNIQUE,
            synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
};

export const getDB = async () => {
    return await open({
        filename: DB_FILE_PATH,
        driver: sqlite3.Database,
    });
};

export const saveSessionToDB = async (type: 'CN' | 'GLOBAL', session: Record<string, any>) => {
    const db = await getDB();
    const encryptedSessionStr = encryptSession(session);
    await db.run(
        `INSERT INTO garmin_session (user,region,session) VALUES (?,?,?)`,
        GARMIN_USERNAME, type, encryptedSessionStr,
    );
};

export const updateSessionToDB = async (type: 'CN' | 'GLOBAL', session: Record<string, any>) => {
    const db = await getDB();
    const encryptedSessionStr = encryptSession(session);
    await db.run(
        'UPDATE garmin_session SET session = ? WHERE user = ? AND region = ?',
        encryptedSessionStr,
        GARMIN_USERNAME,
        type,
    );
};

export const getSessionFromDB = async (type: 'CN' | 'GLOBAL'): Promise<Record<string, any> | undefined> => {
    const db = await getDB();
    const queryResult = await db.get(
        'SELECT session FROM garmin_session WHERE user = ? AND region = ? ',
        GARMIN_USERNAME, type,
    );
    if (!queryResult) {
        return undefined;
    }
    const encryptedSessionStr = queryResult?.session;
    // return {}
    return decryptSession(encryptedSessionStr);
};

// Check if activity has been synced to Google Sheets
export const isActivitySynced = async (activityId: string): Promise<boolean> => {
    const db = await getDB();
    const result = await db.get(
        'SELECT id FROM synced_activities WHERE activity_id = ?',
        activityId
    );
    return !!result;
};

// Mark activity as synced to Google Sheets
export const markActivitySynced = async (activityId: string): Promise<void> => {
    const db = await getDB();
    await db.run(
        'INSERT OR IGNORE INTO synced_activities (activity_id) VALUES (?)',
        activityId
    );
};

export const encryptSession = (session: Record<string, any>): string => {
    const sessionStr = JSON.stringify(session);
    return CryptoJS.AES.encrypt(sessionStr, AESKEY).toString();
};
export const decryptSession = (sessionStr: string): Record<string, any> => {
    const bytes = CryptoJS.AES.decrypt(sessionStr, AESKEY);
    const session = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(session);
};

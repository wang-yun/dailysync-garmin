import { JWT } from 'google-auth-library';
import { google, sheets_v4 } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import { GOOGLE_API_CLIENT_EMAIL_DEFAULT, GOOGLE_API_PRIVATE_KEY_DEFAULT, GOOGLE_SHEET_ID_DEFAULT } from '../constant';

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID ?? GOOGLE_SHEET_ID_DEFAULT;
const GOOGLE_API_CLIENT_EMAIL = process.env.GOOGLE_API_CLIENT_EMAIL ?? GOOGLE_API_CLIENT_EMAIL_DEFAULT;
const GOOGLE_API_PRIVATE_KEY = process.env.GOOGLE_API_PRIVATE_KEY?.replace(/\\n/gm, '\n') ?? GOOGLE_API_PRIVATE_KEY_DEFAULT;
const GOOGLE_SERVICE_ACCOUNT_KEY_PATH = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;

export interface WellnessMetrics {
    date: string;                      // 日期 (YYYY-MM-DD)
    sleepScore?: number;              // 睡眠分数 (0-100)
    sleepDurationTotal?: number;      // 总睡眠时长 (min)
    deepSleepDuration?: number;       // 深睡时长 (min)
    remSleepDuration?: number;        // REM 时长 (min)
    lightSleepDuration?: number;      // 浅睡时长 (min)
    awakeDuration?: number;           // 醒着时长 (min)
    hrvLastNightAvg?: number;          // 昨晚平均 HRV (ms)
    hrvStatusWeekly?: string;          // HRV 七天状态 (BALANCED, UNBALANCED, etc.)
    rhr?: number;                     // 静息心率 (bpm)
    bodyBatteryHigh?: number;          // 身体电量最高值
    bodyBatteryLow?: number;           // 身体电量最低值
    stressAvg?: number;                // 全天平均压力分数
    stressDurationHigh?: number;       // 高压时长 (min)
    minSpO2?: number;                  // 昨晚最低血氧 (%)
    avgSpO2?: number;                  // 昨晚平均血氧 (%)
    avgRespiration?: number;           // 平均呼吸频率 (brpm)
    activeCalories?: number;           // 活动消耗卡路里
    restingCalories?: number;          // 静息消耗卡路里
    steps?: number;                   // 步数
    intensityMinutes?: number;          // 强度分钟数
    floorsClimbed?: number;            // 爬楼层数
    trainingReadiness?: number;         // 佳明训练准备程度分数
}

export interface ActivityMetrics {
    activityId: string;           // 佳明原始活动 ID
    startTime: string;            // 开始时间 (YYYY-MM-DD HH:mm)
    type: string;                  // 运动类型
    title?: string;                // 活动名称
    distanceKm?: number;            // 距离 (km)
    durationTotal?: number;         // 总耗时 (s)
    movingTime?: number;           // 移动耗时 (s)
    avgHr?: number;                // 平均心率
    maxHr?: number;                // 最大心率
    avgPace?: string;              // 平均配速 (min/km)
    avgCadence?: number;            // 平均步频 (步/分)
    avgPower?: number;             // 平均功率 (W)
    totalAscent?: number;           // 累计爬升 (m)
    calories?: number;             // 消耗卡路里
    aerobicTe?: number;            // 有氧训练效果 (0-5.0)
    anaerobicTe?: number;          // 无氧训练效果 (0-5.0)
    trainingLoad?: number;         // 训练负荷数值
    recoveryTime?: number;          // 建议恢复时间 (hrs)
    avgTemp?: number;               // 平均环境温度
    gear?: string;                  // 使用装备 (跑鞋/球拍)
    vo2Max?: number;               // 活动后的最大摄氧量估算
}

export interface GoogleSheetsServiceConfig {
    sheetId?: string;
    clientEmail?: string;
    privateKey?: string;
    credentialsPath?: string;
    sheetName?: string;
    range?: string;
}

interface ServiceAccountCredentials {
    client_email?: string;
    private_key?: string;
}

export class GoogleSheetsService {
    private sheets: sheets_v4.Sheets;
    private spreadsheetId: string;
    private sheetName: string;
    private range: string;

    constructor(config: GoogleSheetsServiceConfig = {}) {
        this.spreadsheetId = config.sheetId ?? GOOGLE_SHEET_ID;
        this.sheetName = config.sheetName ?? '工作表1';
        this.range = config.range ?? 'A1:Z1';

        const client = this.createAuthClient(config);
        // @ts-ignore - GoogleAuth types compatibility issue
        this.sheets = google.sheets({ version: 'v4', auth: client });
    }

    private createAuthClient(config: GoogleSheetsServiceConfig): JWT {
        let email = config.clientEmail ?? GOOGLE_API_CLIENT_EMAIL;
        let key = config.privateKey ?? GOOGLE_API_PRIVATE_KEY;

        const credentialsPath = config.credentialsPath ?? GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
        if (credentialsPath && (!email || !key)) {
            const credentials = this.loadCredentialsFromFile(credentialsPath);
            if (credentials.client_email && credentials.private_key) {
                email = credentials.client_email;
                key = credentials.private_key.replace(/\\n/gm, '\n');
            }
        }

        return new JWT({
            email,
            key,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
    }

    private loadCredentialsFromFile(filePath: string): ServiceAccountCredentials {
        const absolutePath = path.resolve(filePath);
        if (!fs.existsSync(absolutePath)) {
            throw new Error(`credentials.json file not found at: ${absolutePath}`);
        }
        const content = fs.readFileSync(absolutePath, 'utf-8');
        return JSON.parse(content) as ServiceAccountCredentials;
    }

    /**
     * Initialize the spreadsheet: create Wellness_Daily and Activities_Log sheets if they don't exist
     * and write header rows
     */
    async initializeSheets(): Promise<void> {
        const spreadsheet = await this.sheets.spreadsheets.get({
            spreadsheetId: this.spreadsheetId,
        });

        const sheets = spreadsheet.data.sheets ?? [];
        const sheetNames = sheets.map(s => s.properties?.title).filter(Boolean) as string[];

        const wellnessSheetExists = sheetNames.includes('Wellness_Daily');
        const activitiesSheetExists = sheetNames.includes('Activities_Log');

        const requests: sheets_v4.Schema$Request[] = [];

        if (!wellnessSheetExists) {
            requests.push(this.createAddSheetRequest('Wellness_Daily'));
            console.log('Creating sheet: Wellness_Daily');
        }

        if (!activitiesSheetExists) {
            requests.push(this.createAddSheetRequest('Activities_Log'));
            console.log('Creating sheet: Activities_Log');
        }

        if (requests.length > 0) {
            await this.sheets.spreadsheets.batchUpdate({
                spreadsheetId: this.spreadsheetId,
                requestBody: { requests },
            });
        }

        if (!wellnessSheetExists) {
            await this.writeWellnessHeaders();
        }

        if (!activitiesSheetExists) {
            await this.writeActivityHeaders();
        }

        console.log('Sheets initialization completed.');
    }

    private createAddSheetRequest(title: string): sheets_v4.Schema$Request {
        return {
            addSheet: {
                properties: {
                    title,
                    index: 0,
                },
            },
        };
    }

    private async writeWellnessHeaders(): Promise<void> {
        const headers = [
            'Date',
            'Sleep_Score',
            'Sleep_Duration_Total',
            'Deep_Sleep_Duration',
            'REM_Sleep_Duration',
            'Light_Sleep_Duration',
            'Awake_Duration',
            'HRV_LastNight_Avg',
            'HRV_Status_Weekly',
            'RHR',
            'Body_Battery_High',
            'Body_Battery_Low',
            'Stress_Avg',
            'Stress_Duration_High',
            'Min_SpO2',
            'Avg_SpO2',
            'Avg_Respiration',
            'Active_Calories',
            'Resting_Calories',
            'Steps',
            'Intensity_Minutes',
            'Floors_Climbed',
            'Training_Readiness',
        ];

        await this.sheets.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: 'Wellness_Daily!A1:W1',
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [headers] },
        });

        console.log('Wellness_Daily headers written.');
    }

    private async writeActivityHeaders(): Promise<void> {
        const headers = [
            'Activity_ID',
            'Start_Time',
            'Type',
            'Title',
            'Distance_KM',
            'Duration_Total',
            'Moving_Time',
            'Avg_HR',
            'Max_HR',
            'Avg_Pace',
            'Avg_Cadence',
            'Avg_Power',
            'Total_Ascent',
            'Calories',
            'Aerobic_TE',
            'Anaerobic_TE',
            'Training_Load',
            'Recovery_Time',
            'Avg_Temp',
            'Gear',
            'VO2_Max',
        ];

        await this.sheets.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: 'Activities_Log!A1:U1',
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [headers] },
        });

        console.log('Activities_Log headers written.');
    }

    /**
     * Append wellness metrics to the Wellness_Daily sheet (at the end)
     */
    async appendData(data: WellnessMetrics | WellnessMetrics[]): Promise<sheets_v4.Schema$AppendValuesResponse> {
        const metricsArray = Array.isArray(data) ? data : [data];
        const values = metricsArray.map(m => [
            m.date,
            m.sleepScore ?? '',
            m.sleepDurationTotal ?? '',
            m.deepSleepDuration ?? '',
            m.remSleepDuration ?? '',
            m.lightSleepDuration ?? '',
            m.awakeDuration ?? '',
            m.hrvLastNightAvg ?? '',
            m.hrvStatusWeekly ?? '',
            m.rhr ?? '',
            m.bodyBatteryHigh ?? '',
            m.bodyBatteryLow ?? '',
            m.stressAvg ?? '',
            m.stressDurationHigh ?? '',
            m.minSpO2 ?? '',
            m.avgSpO2 ?? '',
            m.avgRespiration ?? '',
            m.activeCalories ?? '',
            m.restingCalories ?? '',
            m.steps ?? '',
            m.intensityMinutes ?? '',
            m.floorsClimbed ?? '',
            m.trainingReadiness ?? '',
        ]);

        const response = await this.sheets.spreadsheets.values.append({
            spreadsheetId: this.spreadsheetId,
            range: 'Wellness_Daily!A1:W1',
            valueInputOption: 'USER_ENTERED',
            requestBody: { values },
        });

        console.log('Appended wellness metrics:', values);
        return response.data;
    }

    /**
     * Append activity metrics to the Activities_Log sheet (at the end)
     */
    async appendActivityData(data: ActivityMetrics | ActivityMetrics[]): Promise<sheets_v4.Schema$AppendValuesResponse> {
        const metricsArray = Array.isArray(data) ? data : [data];
        const values = metricsArray.map(m => [
            m.activityId,
            m.startTime,
            m.type,
            m.title ?? '',
            m.distanceKm ?? '',
            m.durationTotal ?? '',
            m.movingTime ?? '',
            m.avgHr ?? '',
            m.maxHr ?? '',
            m.avgPace ?? '',
            m.avgCadence ?? '',
            m.avgPower ?? '',
            m.totalAscent ?? '',
            m.calories ?? '',
            m.aerobicTe ?? '',
            m.anaerobicTe ?? '',
            m.trainingLoad ?? '',
            m.recoveryTime ?? '',
            m.avgTemp ?? '',
            m.gear ?? '',
            m.vo2Max ?? '',
        ]);

        const response = await this.sheets.spreadsheets.values.append({
            spreadsheetId: this.spreadsheetId,
            range: 'Activities_Log!A1:U1',
            valueInputOption: 'USER_ENTERED',
            requestBody: { values },
        });

        console.log('Appended activity metrics:', values);
        return response.data;
    }

    /**
     * Get the latest row data from a specific sheet
     */
    async getLatestRow(sheetName: string, columnCount: string = 'W'): Promise<string[] | null> {
        const response = await this.sheets.spreadsheets.values.get({
            spreadsheetId: this.spreadsheetId,
            range: `${sheetName}!A1:${columnCount}`,
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) return null;
        return rows[rows.length - 1];
    }

    /**
     * Check if wellness data for the given date already exists
     */
    async hasWellnessDataForDate(date: string): Promise<boolean> {
        const lastRow = await this.getLatestRow('Wellness_Daily', 'W');
        if (!lastRow) return false;
        return lastRow[0] === date;
    }

    /**
     * Check if activity data for the given activity ID already exists
     */
    async hasActivityData(activityId: string): Promise<boolean> {
        const lastRow = await this.getLatestRow('Activities_Log', 'U');
        if (!lastRow) return false;
        return lastRow[0] === activityId;
    }
}

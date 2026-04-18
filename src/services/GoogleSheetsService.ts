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
    timestamp?: string;                // 数据插入时间 (YYYY-MM-DD HH:mm:ss)
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
    locationName?: string;         // 位置名称
    distanceKm?: number;            // 距离 (km)
    durationTotal?: number;         // 总耗时 (s)
    movingTime?: number;           // 移动耗时 (s)
    avgHr?: number;                // 平均心率
    maxHr?: number;                // 最大心率
    avgPace?: string;              // 平均配速 (min/km)
    maxSpeed?: number;              // 最大速度 (m/s)
    avgCadence?: number;            // 平均步频 (步/分)
    maxCadence?: number;            // 最大步频
    avgPower?: number;             // 平均功率 (W)
    avgVerticalOscillation?: number; // 垂直振幅 (cm)
    avgGroundContactTime?: number;   // 触地时间 (ms)
    avgStrideLength?: number;       // 步幅 (cm)
    totalAscent?: number;           // 累计爬升 (m)
    calories?: number;             // 消耗卡路里
    steps?: number;                // 步数
    aerobicTe?: number;            // 有氧训练效果 (0-5.0)
    anaerobicTe?: number;          // 无氧训练效果 (0-5.0)
    trainingLoad?: number;         // 训练负荷数值
    recoveryTime?: number;         // 建议恢复时间 (hrs)
    avgTemp?: number;              // 平均环境温度
    gear?: string;                 // 使用装备 (跑鞋/球拍)
    vo2Max?: number;               // 最大摄氧量
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
            'Location',
            'Distance_KM',
            'Duration_Total',
            'Moving_Time',
            'Avg_HR',
            'Max_HR',
            'Avg_Pace',
            'Max_Speed',
            'Avg_Cadence',
            'Max_Cadence',
            'Avg_Power',
            'Avg_Vertical_Oscillation',
            'Avg_Ground_Contact_Time',
            'Avg_Stride_Length',
            'Total_Ascent',
            'Calories',
            'Steps',
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
            range: 'Activities_Log!A1:AB1',
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
            m.timestamp ?? m.date,
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
     * Insert activity metrics to the Activities_Log sheet at the correct position (sorted by activityId descending, newest first)
     */
    async appendActivityData(data: ActivityMetrics | ActivityMetrics[]): Promise<any> {
        const metricsArray = Array.isArray(data) ? data : [data];
        const sheetId = await this.getSheetId('Activities_Log');

        // Get all existing activityIds from column A to find insert positions
        const response = await this.sheets.spreadsheets.values.get({
            spreadsheetId: this.spreadsheetId,
            range: 'Activities_Log!A:A',
        });

        const existingRows = response.data.values || [];

        for (const metrics of metricsArray) {
            const newActivityId = metrics.activityId;
            const values = [[
                metrics.activityId,
                metrics.startTime,
                metrics.type,
                metrics.title ?? '',
                metrics.locationName ?? '',
                metrics.distanceKm ?? '',
                metrics.durationTotal ?? '',
                metrics.movingTime ?? '',
                metrics.avgHr ?? '',
                metrics.maxHr ?? '',
                metrics.avgPace ?? '',
                metrics.maxSpeed ?? '',
                metrics.avgCadence ?? '',
                metrics.maxCadence ?? '',
                metrics.avgPower ?? '',
                metrics.avgVerticalOscillation ?? '',
                metrics.avgGroundContactTime ?? '',
                metrics.avgStrideLength ?? '',
                metrics.totalAscent ?? '',
                metrics.calories ?? '',
                metrics.steps ?? '',
                metrics.aerobicTe ?? '',
                metrics.anaerobicTe ?? '',
                metrics.trainingLoad ?? '',
                metrics.recoveryTime ?? '',
                metrics.avgTemp ?? '',
                metrics.gear ?? '',
                metrics.vo2Max ?? '',
            ]];

            // Find the insert position: first row where activityId < newActivityId (descending order)
            // Skip header row (i=0), start from i=1
            let insertIndex = existingRows.length; // Default: append at end
            for (let i = 1; i < existingRows.length; i++) {
                const existingId = existingRows[i][0];
                if (existingId && Number(existingId) < Number(newActivityId)) {
                    insertIndex = i;
                    break;
                }
            }

            // Insert a new row at the found position
            await this.sheets.spreadsheets.batchUpdate({
                spreadsheetId: this.spreadsheetId,
                requestBody: {
                    requests: [{
                        insertDimension: {
                            range: {
                                sheetId: sheetId,
                                dimension: 'ROWS',
                                startIndex: insertIndex,
                                endIndex: insertIndex + 1
                            },
                            inheritFromBefore: false
                        }
                    }]
                }
            });

            // Write the data to the inserted row
            const range = `Activities_Log!A${insertIndex + 1}:AB${insertIndex + 1}`;
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: range,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values },
            });

            // Update existingRows to reflect the insertion for the next iteration
            existingRows.splice(insertIndex, 0, [newActivityId]);

            console.log(`Inserted activity ${newActivityId} at row ${insertIndex + 1}`);
        }

        return { success: true };
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
        const rowNum = await this.findWellnessRowByDate(date);
        return rowNum > 0;
    }

    /**
     * Find the row number for a given date in Wellness_Daily (returns 0 if not found)
     * Since column A now contains timestamp (YYYY-MM-DD HH:mm:ss), we check if timestamp starts with date
     */
    async findWellnessRowByDate(date: string): Promise<number> {
        const response = await this.sheets.spreadsheets.values.get({
            spreadsheetId: this.spreadsheetId,
            range: 'Wellness_Daily!A:A',
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) return 0;

        for (let i = 1; i < rows.length; i++) {
            const timestamp = rows[i][0] || '';
            if (timestamp.startsWith(date)) {
                return i + 1; // 1-indexed row number
            }
        }
        return 0;
    }

    /**
     * Insert wellness data at row 2 (newest first, multiple inserts per day allowed)
     */
    async updateWellnessData(data: WellnessMetrics): Promise<void> {
        const date = data.date;
        const sheetId = await this.getSheetId('Wellness_Daily');

        const values = [[
            data.timestamp ?? data.date,
            data.sleepScore ?? '',
            data.sleepDurationTotal ?? '',
            data.deepSleepDuration ?? '',
            data.remSleepDuration ?? '',
            data.lightSleepDuration ?? '',
            data.awakeDuration ?? '',
            data.hrvLastNightAvg ?? '',
            data.hrvStatusWeekly ?? '',
            data.rhr ?? '',
            data.bodyBatteryHigh ?? '',
            data.bodyBatteryLow ?? '',
            data.stressAvg ?? '',
            data.stressDurationHigh ?? '',
            data.minSpO2 ?? '',
            data.avgSpO2 ?? '',
            data.avgRespiration ?? '',
            data.activeCalories ?? '',
            data.restingCalories ?? '',
            data.steps ?? '',
            data.intensityMinutes ?? '',
            data.floorsClimbed ?? '',
            data.trainingReadiness ?? '',
        ]];

        // Always insert at row 2, pushing existing data down
        await this.sheets.spreadsheets.batchUpdate({
            spreadsheetId: this.spreadsheetId,
            requestBody: {
                requests: [
                    {
                        insertDimension: {
                            range: {
                                sheetId: sheetId,
                                dimension: 'ROWS',
                                startIndex: 1,
                                endIndex: 2,
                            },
                        },
                    },
                ],
            },
        });

        await this.sheets.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: 'Wellness_Daily!A2:W2',
            valueInputOption: 'USER_ENTERED',
            requestBody: { values },
        });

        console.log(`Inserted new wellness data for ${date} at row 2`);
    }

    /**
     * Get sheet ID by name
     */
    async getSheetId(sheetName: string): Promise<number> {
        const spreadsheet = await this.sheets.spreadsheets.get({
            spreadsheetId: this.spreadsheetId,
        });

        const sheet = spreadsheet.data.sheets?.find(s => s.properties?.title === sheetName);
        return sheet?.properties?.sheetId ?? 0;
    }

    /**
     * Check if activity data for the given activity ID already exists
     */
    async hasActivityData(activityId: string): Promise<boolean> {
        const response = await this.sheets.spreadsheets.values.get({
            spreadsheetId: this.spreadsheetId,
            range: 'Activities_Log!A:A',
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) return false;

        // Skip header row (row 1)
        for (let i = 1; i < rows.length; i++) {
            const rowActivityId = rows[i][0] || '';
            if (rowActivityId === activityId) {
                return true;
            }
        }
        return false;
    }

    /**
     * Find the row number for a given activity ID in Activities_Log (returns 0 if not found)
     */
    async findActivityRowById(activityId: string): Promise<number> {
        const response = await this.sheets.spreadsheets.values.get({
            spreadsheetId: this.spreadsheetId,
            range: 'Activities_Log!A:A',
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) return 0;

        // Skip header row (row 1)
        for (let i = 1; i < rows.length; i++) {
            const rowActivityId = rows[i][0] || '';
            if (rowActivityId === activityId) {
                return i + 1; // 1-indexed row number
            }
        }
        return 0;
    }

    /**
     * Update an existing activity row with new data (upsert behavior)
     * If activity exists, update it; otherwise insert new row
     */
    async updateActivityData(metrics: ActivityMetrics): Promise<void> {
        const rowNum = await this.findActivityRowById(metrics.activityId);
        if (rowNum === 0) {
            console.log(`Activity ${metrics.activityId} not found, inserting new row`);
            await this.appendActivityData(metrics);
            return;
        }

        const values = [[
            metrics.activityId,
            metrics.startTime,
            metrics.type,
            metrics.title ?? '',
            metrics.locationName ?? '',
            metrics.distanceKm ?? '',
            metrics.durationTotal ?? '',
            metrics.movingTime ?? '',
            metrics.avgHr ?? '',
            metrics.maxHr ?? '',
            metrics.avgPace ?? '',
            metrics.maxSpeed ?? '',
            metrics.avgCadence ?? '',
            metrics.maxCadence ?? '',
            metrics.avgPower ?? '',
            metrics.avgVerticalOscillation ?? '',
            metrics.avgGroundContactTime ?? '',
            metrics.avgStrideLength ?? '',
            metrics.totalAscent ?? '',
            metrics.calories ?? '',
            metrics.steps ?? '',
            metrics.aerobicTe ?? '',
            metrics.anaerobicTe ?? '',
            metrics.trainingLoad ?? '',
            metrics.recoveryTime ?? '',
            metrics.avgTemp ?? '',
            metrics.gear ?? '',
            metrics.vo2Max ?? '',
        ]];

        const range = `Activities_Log!A${rowNum}:AB${rowNum}`;
        await this.sheets.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: range,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values },
        });

        console.log(`Updated activity ${metrics.activityId} at row ${rowNum}`);
    }


}
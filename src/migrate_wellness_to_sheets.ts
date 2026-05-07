import 'dotenv/config';
import { BARK_KEY_DEFAULT } from './constant';
import { getGaminCNClient } from './utils/garmin_cn';
import { getGarminWellnessData } from './utils/garmin_common';
import { GoogleSheetsService } from './services/GoogleSheetsService';

const axios = require('axios');
const core = require('@actions/core');

const BARK_KEY = process.env.BARK_KEY ?? BARK_KEY_DEFAULT;
const WELLNESS_DAYS_TO_MIGRATE = parseInt(process.env.WELLNESS_DAYS_TO_MIGRATE ?? '365', 10);

export interface MigrateWellnessOptions {
    /** 指定日期 YYYY-MM-DD，单项同步 */
    date?: string;
    /** 往前追溯天数（默认 365） */
    days?: number;
}

export interface MigrateWellnessResult {
    migrated: number;
    skipped: number;
    errors: number;
}

/**
 * 迁移：中国区健康数据 → Google Sheets
 *
 * 两种模式：
 * 1. 指定日期：传入 date 参数，只同步那一天的 wellness
 * 2. 范围模式：传入 days 参数或使用 WELLNESS_DAYS_TO_MIGRATE 环境变量
 */
export async function runMigrateWellness(options?: MigrateWellnessOptions): Promise<MigrateWellnessResult> {
    console.log('=== Garmin CN Wellness → Google Sheets ===\n');

    const clientCN = await getGaminCNClient();
    const sheetsService = new GoogleSheetsService();

    console.log('Initializing Google Sheets...');
    await sheetsService.initializeSheets();
    console.log('Google Sheets initialized.\n');

    // ── 模式判断：指定日期  vs 范围模式 ──
    const days = options?.days ?? WELLNESS_DAYS_TO_MIGRATE;

    if (options?.date) {
        console.log(`模式: 指定日期 (${options.date})\n`);
    } else {
        console.log(`模式: 范围 (往前 ${days} 天)\n`);
    }

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // 生成日期列表
    const dates: string[] = [];
    if (options?.date) {
        dates.push(options.date);
    } else {
        const today = new Date();
        for (let d = 0; d < days; d++) {
            const date = new Date(today);
            date.setDate(date.getDate() - d);
            dates.push(date.toISOString().split('T')[0]);
        }
    }

    const total = dates.length;

    for (let i = 0; i < total; i++) {
        const dateString = dates[i];
        const dateObj = new Date(dateString + 'T00:00:00');

        try {
            const hasExisting = await sheetsService.hasWellnessDataForDate(dateString);
            if (hasExisting) {
                console.log(`[${i + 1}/${total}] ⏭️ 跳过（已存在）: ${dateString}`);
                skippedCount++;
                continue;
            }

            const wellnessData = await getGarminWellnessData(clientCN, dateObj);
            if (Object.keys(wellnessData).length > 1) {
                await sheetsService.appendData(wellnessData);
                console.log(`[${i + 1}/${total}] ✅ 已迁移: ${dateString}`);
                migratedCount++;
            } else {
                console.log(`[${i + 1}/${total}] ⚠️ 无数据: ${dateString}`);
            }

            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (e) {
            console.error(`[${i + 1}/${total}] ❌ 错误: ${dateString} - ${e.message}`);
            errorCount++;
        }
    }

    console.log(`\n=== 完成 ===`);
    console.log(`已迁移: ${migratedCount}`);
    console.log(`已跳过: ${skippedCount}`);
    console.log(`错误: ${errorCount}`);

    return { migrated: migratedCount, skipped: skippedCount, errors: errorCount };
}

// 直接运行时自执行
const isDirectRun = require.main === module || process.argv[1]?.endsWith('migrate_wellness_to_sheets.ts');
if (isDirectRun) {
    (async () => {
        try {
            await runMigrateWellness();
        } catch (e: any) {
            console.error('Migration failed:', e);
            if (BARK_KEY) {
                axios.get(`https://api.day.app/${BARK_KEY}/Wellness -> Google Sheets 迁移失败了/${e.message}`);
            }
            core.setFailed(e.message);
            process.exit(1);
        }
    })();
}

import 'dotenv/config';
import { BARK_KEY_DEFAULT } from './constant';
import { getGaminCNClient } from './utils/garmin_cn';
import { mapActivityFromGarmin } from './utils/garmin_common';
import { GoogleSheetsService } from './services/GoogleSheetsService';

const axios = require('axios');
const core = require('@actions/core');

const BARK_KEY = process.env.BARK_KEY ?? BARK_KEY_DEFAULT;
const MIGRATE_NUM = parseInt(process.env.GARMIN_MIGRATE_NUM ?? '100', 10);
const MIGRATE_START = parseInt(process.env.GARMIN_MIGRATE_START ?? '0', 10);

export interface MigrateCnToSheetsOptions {
    /** 指定活动 ID（逗号分隔），跳过则使用范围模式 */
    activityIds?: string[];
}

export interface MigrateCnToSheetsResult {
    activitiesMigrated: number;
    activitiesSkipped: number;
}

/**
 * 迁移：中国区活动 → Google Sheets
 *
 * 两种模式：
 * 1. 指定活动 ID：传入 activityIds 数组，精确匹配
 * 2. 范围模式：使用 GARMIN_MIGRATE_START / GARMIN_MIGRATE_NUM 环境变量
 */
export async function runMigrateCnToSheets(options?: MigrateCnToSheetsOptions): Promise<MigrateCnToSheetsResult> {
    console.log('=== Garmin CN 活动 → Google Sheets ===\n');

    const clientCN = await getGaminCNClient();
    const sheetsService = new GoogleSheetsService();

    console.log('Initializing Google Sheets...');
    await sheetsService.initializeSheets();
    console.log('Google Sheets initialized.\n');

    // ── 模式判断：指定活动 ID  vs 范围模式 ──
    const specificIds = options?.activityIds?.filter(Boolean) ?? [];
    const useSpecificIds = specificIds.length > 0;

    if (useSpecificIds) {
        console.log(`模式: 指定活动 ID (${specificIds.length} 个)\n`);
    } else {
        console.log(`模式: 范围 (start=${MIGRATE_START}, count=${MIGRATE_NUM})\n`);
    }

    // ── 获取活动列表 ──
    console.log('Fetching activities from Garmin CN...');
    const fetchAll = await clientCN.getActivities(0, useSpecificIds ? Math.max(MIGRATE_NUM, specificIds.length + 100) : MIGRATE_NUM);

    let activities: any[];
    if (useSpecificIds) {
        const idSet = new Set(specificIds);
        activities = fetchAll.filter((a: any) => idSet.has(String(a.activityId)));
        console.log(`匹配到 ${activities.length}/${specificIds.length} 个指定活动\n`);
        const unmatched = specificIds.filter(id => !activities.some((a: any) => String(a.activityId) === id));
        if (unmatched.length > 0) {
            console.log(`⚠️ 以下活动 ID 未找到（可能不在最近 ${Math.max(MIGRATE_NUM, specificIds.length + 100)} 条记录中）:`);
            unmatched.forEach(id => console.log(`   ${id}`));
            console.log();
        }
    } else {
        activities = fetchAll.slice(MIGRATE_START);
        console.log(`共 ${activities.length} 个活动待处理\n`);
    }

    let migratedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < activities.length; i++) {
        const activity = activities[i];
        const activityId = String(activity.activityId);

        try {
            const activityMetrics = mapActivityFromGarmin(activity);
            const hasExisting = await sheetsService.hasActivityData(activityId);
            if (hasExisting) {
                if (specificIds && specificIds.length > 0) {
                    // 指定 ID 模式：覆盖更新
                    await sheetsService.updateActivityData(activityMetrics);
                    console.log(`[${i + 1}/${activities.length}] 🔄 已更新: ${activity.activityName} (${activityId})`);
                    migratedCount++;
                } else {
                    // 范围模式：跳过
                    console.log(`[${i + 1}/${activities.length}] ⏭️ 跳过（已存在）: ${activity.activityName} (${activityId})`);
                    skippedCount++;
                    continue;
                }
            } else {
                await sheetsService.appendActivityData(activityMetrics);
                console.log(`[${i + 1}/${activities.length}] ✅ 已迁移: ${activity.activityName} (${activityId})`);
                migratedCount++;
            }

            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (e) {
            console.error(`[${i + 1}/${activities.length}] ❌ 错误: ${activityId} - ${e.message}`);
        }
    }

    console.log(`\n=== 完成 ===`);
    console.log(`已迁移: ${migratedCount}`);
    console.log(`已跳过: ${skippedCount}`);

    return { activitiesMigrated: migratedCount, activitiesSkipped: skippedCount };
}

// 直接运行时自执行
const isDirectRun = require.main === module || process.argv[1]?.endsWith('migrate_garmin_cn_to_sheets.ts');
if (isDirectRun) {
    (async () => {
        try {
            const result = await runMigrateCnToSheets();
            if (result.activitiesMigrated === 0 && result.activitiesSkipped === 0) {
                console.log('⚠️ 无活动被处理，请检查活动 ID 是否正确');
            }
        } catch (e: any) {
            console.error('Migration failed:', e);
            if (BARK_KEY) {
                axios.get(`https://api.day.app/${BARK_KEY}/Garmin CN -> Google Sheets 迁移失败了/${e.message}`);
            }
            core.setFailed(e.message);
            process.exit(1);
        }
    })();
}

import 'dotenv/config';
import { BARK_KEY_DEFAULT } from './constant';
import { syncGarminCN2GarminGlobal } from './utils/garmin_cn';
import { sendFeishuNotification } from './utils/feishu';

const axios = require('axios');
const core = require('@actions/core');
const BARK_KEY = process.env.BARK_KEY ?? BARK_KEY_DEFAULT;

/**
 * 日常同步：中国区运动数据 → 国际区 + Google Sheets + 飞书通知
 */
export async function runSyncCnToGlobal() {
    const result = await syncGarminCN2GarminGlobal();

    if (result.success) {
        console.log('Daily sync completed successfully.');

        if (BARK_KEY) {
            let barkMsg = 'Garmin 同步完成';
            if (result.wellnessSkipped) {
                barkMsg += `\n健康数据: 已存在 (${result.wellnessDate})`;
            }
            if (result.activitySynced !== undefined) {
                barkMsg += `\n活动: 新增 ${result.activitySynced} 条`;
            }
            axios.get(`https://api.day.app/${BARK_KEY}/${barkMsg}`);
        }

        await sendFeishuNotification({
            success: true,
            wellnessData: {
                date: result.wellnessDate || '',
                timestamp: result.wellnessMetrics?.timestamp || '',
                synced: !!result.wellnessMetrics,
                skipped: result.wellnessSkipped || false,
                metrics: result.wellnessMetrics
            },
            activityData: {
                count: (result.activitySynced || 0) + (result.activitySkipped || 0),
                synced: result.activitySynced || 0,
                skipped: result.activitySkipped || 0,
                activities: result.activityMetrics
            }
        });
    } else {
        throw new Error(result.error);
    }
}

// 直接运行时自执行
const isDirectRun = require.main === module || process.argv[1]?.endsWith('sync_garmin_cn_to_global.ts');
if (isDirectRun) {
    (async () => {
        try {
            await runSyncCnToGlobal();
        } catch (e: any) {
            console.error('Daily sync failed:', e.message);
            if (BARK_KEY) {
                axios.get(`https://api.day.app/${BARK_KEY}/Garmin CN -> Google Sheets 同步失败/${e.message}`);
            }
            await sendFeishuNotification({ success: false, error: e.message });
            core.setFailed(e.message);
            process.exit(1);
        }
    })();
}

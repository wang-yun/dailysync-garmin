import 'dotenv/config';
import { BARK_KEY_DEFAULT } from './constant';
import { syncGarminCN2GarminGlobal } from './utils/garmin_cn';
import { sendFeishuNotification } from './utils/feishu';

const axios = require('axios');
const core = require('@actions/core');
const BARK_KEY = process.env.BARK_KEY ?? BARK_KEY_DEFAULT;

async function run() {
    try {
        const result = await syncGarminCN2GarminGlobal();

        if (result.success) {
            console.log('Daily sync completed successfully.');

            // Send Bark notification
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

            // Send Feishu notification
            await sendFeishuNotification({
                success: true,
                wellnessData: {
                    date: result.wellnessDate || '',
                    synced: !result.wellnessSkipped,
                    skipped: result.wellnessSkipped || false
                },
                activityData: {
                    count: (result.activitySynced || 0) + (result.activitySkipped || 0),
                    synced: result.activitySynced || 0,
                    skipped: result.activitySkipped || 0
                }
            });
        } else {
            throw new Error(result.error);
        }
    } catch (e: any) {
        console.error('Daily sync failed:', e.message);

        // Send Bark notification
        if (BARK_KEY) {
            axios.get(
                `https://api.day.app/${BARK_KEY}/Garmin CN -> Google Sheets 同步失败/${e.message}`);
        }

        // Send Feishu notification
        await sendFeishuNotification({
            success: false,
            error: e.message
        });

        core.setFailed(e.message);
        throw new Error(e);
    }
}

run();





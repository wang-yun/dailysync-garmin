import 'dotenv/config';
import { BARK_KEY_DEFAULT } from './constant';
import { migrateGarminCN2GarminGlobal } from './utils/garmin_cn';

const axios = require('axios');
const core = require('@actions/core');
const BARK_KEY = process.env.BARK_KEY ?? BARK_KEY_DEFAULT;

/**
 * 历史迁移：中国区 → 国际区
 */
export async function runMigrateCnToGlobal() {
    await migrateGarminCN2GarminGlobal();
}

// 直接运行时自执行
const isDirectRun = require.main === module || process.argv[1]?.endsWith('migrate_garmin_cn_to_global.ts');
if (isDirectRun) {
    (async () => {
        try {
            await runMigrateCnToGlobal();
        } catch (e: any) {
            axios.get(
                `https://api.day.app/${BARK_KEY}/Garmin CN -> Garmin Global 同步数据运行失败了，快去检查！/${e.message}`);
            core.setFailed(e.message);
            process.exit(1);
        }
    })();
}

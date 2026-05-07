import 'dotenv/config';
import { BARK_KEY_DEFAULT } from './constant';
import { migrateGarminGlobal2GarminCN } from './utils/garmin_global';

const axios = require('axios');
const core = require('@actions/core');
const BARK_KEY = process.env.BARK_KEY ?? BARK_KEY_DEFAULT;

/**
 * 历史迁移：国际区 → 中国区
 */
export async function runMigrateGlobalToCn() {
    await migrateGarminGlobal2GarminCN();
}

// 直接运行时自执行
const isDirectRun = require.main === module || process.argv[1]?.endsWith('migrate_garmin_global_to_cn.ts');
if (isDirectRun) {
    (async () => {
        try {
            await runMigrateGlobalToCn();
        } catch (e: any) {
            axios.get(
                `https://api.day.app/${BARK_KEY}/Garmin Global -> Garmin CN 同步数据运行失败了，快去检查！/${e.message}`);
            core.setFailed(e.message);
            process.exit(1);
        }
    })();
}

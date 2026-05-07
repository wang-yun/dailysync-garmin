import 'dotenv/config';
import { BARK_KEY_DEFAULT } from './constant';
import { doRQGoogleSheets } from './utils/runningquotient';

const axios = require('axios');
const core = require('@actions/core');

const BARK_KEY = process.env.BARK_KEY ?? BARK_KEY_DEFAULT;

/**
 * RQ 跑力数据采集 → Google Sheets
 */
export async function runRq() {
    await doRQGoogleSheets();
}

// 直接运行时自执行
const isDirectRun = require.main === module || process.argv[1]?.endsWith('rq.ts');
if (isDirectRun) {
    (async () => {
        try {
            await runRq();
        } catch (e: any) {
            axios.get(`https://api.day.app/${BARK_KEY}/同步数据运行失败了，快去检查！/${e.message}`);
            core.setFailed(e.message);
            process.exit(1);
        }
    })();
}

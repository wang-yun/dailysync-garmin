import 'dotenv/config';
import { BARK_KEY_DEFAULT } from './constant';
import { syncGarminCN2GarminGlobal } from './utils/garmin_cn';

const axios = require('axios');
const core = require('@actions/core');
const BARK_KEY = process.env.BARK_KEY ?? BARK_KEY_DEFAULT;

async function run() {
    try {
        await syncGarminCN2GarminGlobal();
        console.log('Daily sync completed successfully.');
    } catch (e: any) {
        console.error('Daily sync failed:', e.message);
        if (BARK_KEY) {
            axios.get(
                `https://api.day.app/${BARK_KEY}/Garmin CN -> Google Sheets 同步失败/${e.message}`);
        }
        core.setFailed(e.message);
        throw new Error(e);
    }
}

run();





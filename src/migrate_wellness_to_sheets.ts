import 'dotenv/config';
import { BARK_KEY_DEFAULT } from './constant';
import { getGaminCNClient } from './utils/garmin_cn';
import { getGarminWellnessData } from './utils/garmin_common';
import { GoogleSheetsService } from './services/GoogleSheetsService';

const axios = require('axios');
const core = require('@actions/core');

const BARK_KEY = process.env.BARK_KEY ?? BARK_KEY_DEFAULT;
const WELLNESS_DAYS_TO_MIGRATE = parseInt(process.env.WELLNESS_DAYS_TO_MIGRATE ?? '365', 10);

async function migrateWellnessToSheets() {
    console.log('=== Garmin CN Wellness -> Google Sheets Migration ===\n');
    console.log(`Migration config: days=${WELLNESS_DAYS_TO_MIGRATE}\n`);

    const clientCN = await getGaminCNClient();
    const sheetsService = new GoogleSheetsService();

    console.log('Initializing Google Sheets...');
    await sheetsService.initializeSheets();
    console.log('Google Sheets initialized.\n');

    const today = new Date();
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (let d = 0; d < WELLNESS_DAYS_TO_MIGRATE; d++) {
        const date = new Date(today);
        date.setDate(date.getDate() - d);
        const dateString = date.toISOString().split('T')[0];

        try {
            const hasExisting = await sheetsService.hasWellnessDataForDate(dateString);
            if (hasExisting) {
                console.log(`[${d + 1}/${WELLNESS_DAYS_TO_MIGRATE}] Skipped (exists): ${dateString}`);
                skippedCount++;
                continue;
            }

            const wellnessData = await getGarminWellnessData(clientCN, date);
            if (Object.keys(wellnessData).length > 1) {
                await sheetsService.appendData(wellnessData);
                console.log(`[${d + 1}/${WELLNESS_DAYS_TO_MIGRATE}] Migrated: ${dateString}`);
                migratedCount++;
            } else {
                console.log(`[${d + 1}/${WELLNESS_DAYS_TO_MIGRATE}] No data: ${dateString}`);
            }

            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (e) {
            console.error(`[${d + 1}/${WELLNESS_DAYS_TO_MIGRATE}] Error: ${e.message}`);
            errorCount++;
        }
    }

    console.log(`\n=== Migration Complete ===`);
    console.log(`Total days attempted: ${WELLNESS_DAYS_TO_MIGRATE}`);
    console.log(`Migrated: ${migratedCount}`);
    console.log(`Skipped (already exists): ${skippedCount}`);
    console.log(`Errors: ${errorCount}`);
}

try {
    migrateWellnessToSheets();
} catch (e) {
    console.error('Migration failed:', e);
    if (BARK_KEY) {
        axios.get(
            `https://api.day.app/${BARK_KEY}/Wellness -> Google Sheets 迁移失败了/${e.message}`);
    }
    core.setFailed(e.message);
    throw new Error(e);
}

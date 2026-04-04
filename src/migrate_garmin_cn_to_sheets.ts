import 'dotenv/config';
import { BARK_KEY_DEFAULT } from './constant';
import { getGaminCNClient } from './utils/garmin_cn';
import { getGarminWellnessData, mapActivityFromGarmin } from './utils/garmin_common';
import { GoogleSheetsService } from './services/GoogleSheetsService';
import { number2capital } from './utils/number_tricks';

const axios = require('axios');
const core = require('@actions/core');

const BARK_KEY = process.env.BARK_KEY ?? BARK_KEY_DEFAULT;
const MIGRATE_NUM = parseInt(process.env.GARMIN_MIGRATE_NUM ?? '100', 10);
const MIGRATE_START = parseInt(process.env.GARMIN_MIGRATE_START ?? '0', 10);

async function migrateGarminCNToSheets() {
    console.log('=== Garmin CN -> Google Sheets Migration ===\n');
    console.log(`Migration config: start=${MIGRATE_START}, count=${MIGRATE_NUM}\n`);

    const clientCN = await getGaminCNClient();
    const sheetsService = new GoogleSheetsService();

    console.log('Initializing Google Sheets...');
    await sheetsService.initializeSheets();
    console.log('Google Sheets initialized.\n');

    console.log('Fetching activities from Garmin CN...');
    const activities = await clientCN.getActivities(MIGRATE_START, MIGRATE_NUM);
    console.log(`Found ${activities.length} activities to migrate.\n`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < activities.length; i++) {
        const activity = activities[i];
        const activityId = String(activity.activityId);

        try {
            const hasExisting = await sheetsService.hasActivityData(activityId);
            if (hasExisting) {
                console.log(`[${i + 1}/${activities.length}] Skipped (exists): ${activity.activityName} (${activityId})`);
                skippedCount++;
                continue;
            }

            const activityMetrics = mapActivityFromGarmin(activity);
            await sheetsService.appendActivityData(activityMetrics);
            console.log(`[${i + 1}/${activities.length}] Migrated: ${activity.activityName} (${activityId})`);
            migratedCount++;

            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (e) {
            console.error(`Error migrating activity ${activityId}:`, e.message);
        }
    }

    console.log(`\n=== Activity Migration Summary ===`);
    console.log(`Total: ${activities.length}`);
    console.log(`Migrated: ${migratedCount}`);
    console.log(`Skipped: ${skippedCount}\n`);

    console.log('=== Migrating Wellness Data ===\n');
    const today = new Date();
    let wellnessMigrated = 0;

    const daysToMigrate = parseInt(process.env.WELLNESS_DAYS_TO_MIGRATE ?? '30', 10);
    console.log(`Migrating wellness data for the last ${daysToMigrate} days...\n`);

    for (let d = 0; d < daysToMigrate; d++) {
        const date = new Date(today);
        date.setDate(date.getDate() - d);
        const dateString = date.toISOString().split('T')[0];

        try {
            const hasExistingWellness = await sheetsService.hasWellnessDataForDate(dateString);
            if (hasExistingWellness) {
                console.log(`[${d + 1}/${daysToMigrate}] Skipped (exists): ${dateString}`);
                continue;
            }

            const wellnessData = await getGarminWellnessData(clientCN, date);
            if (Object.keys(wellnessData).length > 1) {
                await sheetsService.appendData(wellnessData);
                console.log(`[${d + 1}/${daysToMigrate}] Migrated wellness: ${dateString}`);
                wellnessMigrated++;
            } else {
                console.log(`[${d + 1}/${daysToMigrate}] No wellness data: ${dateString}`);
            }

            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (e) {
            console.error(`Error migrating wellness for ${dateString}:`, e.message);
        }
    }

    console.log(`\n=== Wellness Migration Summary ===`);
    console.log(`Days attempted: ${daysToMigrate}`);
    console.log(`Migrated: ${wellnessMigrated}\n`);

    console.log('=== Migration Complete ===');
    console.log(`Activities: ${migratedCount} migrated, ${skippedCount} skipped`);
    console.log(`Wellness: ${wellnessMigrated} migrated`);
}

try {
    migrateGarminCNToSheets();
} catch (e) {
    console.error('Migration failed:', e);
    if (BARK_KEY) {
        axios.get(
            `https://api.day.app/${BARK_KEY}/Garmin CN -> Google Sheets 迁移失败了/${e.message}`);
    }
    core.setFailed(e.message);
    throw new Error(e);
}

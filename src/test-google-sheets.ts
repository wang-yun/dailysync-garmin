import 'dotenv/config';
import { GoogleSheetsService, WellnessMetrics, ActivityMetrics } from './services/GoogleSheetsService';

async function runTest() {
    console.log('=== GoogleSheetsService Test ===\n');

    const service = new GoogleSheetsService({
        credentialsPath: './credentials.json',
    });

    try {
        // Step 1: Initialize sheets
        console.log('Step 1: Initializing sheets...');
        await service.initializeSheets();
        console.log('Initialization completed.\n');

        // Step 2: Test wellness data
        console.log('Step 2: Testing wellness data...');
        const wellnessData: WellnessMetrics = {
            date: '2026-04-04',
            sleepScore: 85,
            sleepDurationTotal: 420,
            deepSleepDuration: 95,
            remSleepDuration: 88,
            lightSleepDuration: 237,
            awakeDuration: 12,
            hrvLastNightAvg: 65,
            hrvStatusWeekly: 62,
            rhr: 52,
            bodyBatteryHigh: 95,
            bodyBatteryLow: 20,
            stressAvg: 42,
            stressDurationHigh: 35,
            minSpO2: 94,
            avgSpO2: 97,
            avgRespiration: 14,
            activeCalories: 450,
            restingCalories: 1650,
            steps: 8500,
            intensityMinutes: 30,
            floorsClimbed: 8,
            trainingReadiness: 78,
        };

        const hasExistingWellness = await service.hasWellnessDataForDate('2026-04-04');
        if (!hasExistingWellness) {
            await service.appendData(wellnessData);
            console.log('Wellness data appended successfully.\n');
        } else {
            console.log('Wellness data for 2026-04-04 already exists, skipping.\n');
        }

        // Step 3: Test activity data
        console.log('Step 3: Testing activity data...');
        const activityData: ActivityMetrics = {
            activityId: 'TEST_001',
            startTime: '2026-04-04 07:30',
            type: 'running',
            title: '晨跑测试',
            distanceKm: 5.2,
            durationTotal: 1800,
            movingTime: 1750,
            avgHr: 145,
            maxHr: 168,
            avgPace: '5:45',
            avgCadence: 172,
            avgPower: 280,
            totalAscent: 35,
            calories: 420,
            aerobicTe: 3.5,
            anaerobicTe: 1.2,
            trainingLoad: 125,
            recoveryTime: 24,
            avgTemp: 18,
            gear: 'Nike Vaporfly 3',
            vo2Max: 48,
        };

        const hasExistingActivity = await service.hasActivityData('TEST_001');
        if (!hasExistingActivity) {
            await service.appendActivityData(activityData);
            console.log('Activity data appended successfully.\n');
        } else {
            console.log('Activity data TEST_001 already exists, skipping.\n');
        }

        // Step 4: Verify data
        console.log('Step 4: Verifying data...');
        const lastWellnessRow = await service.getLatestRow('Wellness_Daily', 'W');
        console.log('Last Wellness_Daily row:', lastWellnessRow);

        const lastActivityRow = await service.getLatestRow('Activities_Log', 'U');
        console.log('Last Activities_Log row:', lastActivityRow);

        console.log('\n=== All tests passed! ===');
    } catch (error) {
        console.error('Test failed:', error);
        throw error;
    }
}

runTest();

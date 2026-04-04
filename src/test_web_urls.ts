import 'dotenv/config';
import { getGaminCNClient } from './utils/garmin_cn';

async function testWebUrls() {
    console.log('=== Test Garmin CN Web App URLs ===\n');

    const client = await getGaminCNClient();
    const internalClient = (client as any).client;

    const testUrls = [
        'https://connect.garmin.cn/app/sleep/2026-04-04',
        'https://connect.garmin.cn/app/health-status/2026-04-04',
        'https://connect.garmin.cn/app/stress/2026-04-04/0',
        'https://connect.garmin.cn/app/heart-rate/2026-04-04',
        'https://connect.garmin.cn/app/body-battery',
    ];

    for (const url of testUrls) {
        try {
            console.log(`\nTesting: ${url}`);
            const result = await internalClient.get(url);
            console.log('Result type:', typeof result);
            console.log('Result (first 500 chars):', JSON.stringify(result).substring(0, 500));
        } catch (e: any) {
            console.log('Error:', e.message);
        }
    }
}

testWebUrls().catch(console.error);

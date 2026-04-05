import 'dotenv/config';
import { sendFeishuNotification } from './utils/feishu';

async function testFeishu() {
    console.log('Testing Feishu notification...\n');

    // Test success notification
    console.log('1. Testing success notification...');
    await sendFeishuNotification({
        success: true,
        wellnessData: {
            date: '2026-04-04',
            synced: true,
            skipped: false
        },
        activityData: {
            count: 2,
            synced: 1,
            skipped: 1
        }
    });

    console.log('\n✅ Test completed! Check your Feishu messages.');
}

testFeishu().catch(console.error);

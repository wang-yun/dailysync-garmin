import 'dotenv/config';
import { getGaminCNClient } from './utils/garmin_cn';

async function test() {
    console.log('=== Test Activity Details ===\n');

    const client = await getGaminCNClient();

    // Get recent activities
    const activities = await client.getActivities(0, 3);
    console.log('Activities count:', activities.length);

    if (activities.length > 0) {
        const act = activities[0];
        console.log('\n--- Activity from getActivities (summary) ---');
        console.log('activityId:', act.activityId);
        console.log('activityName:', act.activityName);
        console.log('Keys:', Object.keys(act));
        console.log('Full activity:', JSON.stringify(act, null, 2).substring(0, 3000));
    }

    // Try getActivityDetails or similar
    if (activities.length > 0) {
        const actId = activities[0].activityId;
        console.log('\n\n--- Trying getActivity details for:', actId, '---');

        try {
            const detail = await (client as any).getActivity({ activityId: actId });
            console.log('Detail keys:', Object.keys(detail));
            console.log('Detail:', JSON.stringify(detail, null, 2).substring(0, 2000));
        } catch (e: any) {
            console.log('Error:', e.message);
        }
    }
}

test().catch(console.error);

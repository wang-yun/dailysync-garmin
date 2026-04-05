import axios from 'axios';

const FEISHU_WEBHOOK = process.env.FEISHU_WEBHOOK;

export interface SyncResult {
    success: boolean;
    wellnessData?: {
        date: string;
        synced: boolean;
        skipped: boolean;
    };
    activityData?: {
        count: number;
        synced: number;
        skipped: number;
    };
    error?: string;
}

/**
 * Send sync result notification to Feishu
 */
export const sendFeishuNotification = async (result: SyncResult): Promise<void> => {
    if (!FEISHU_WEBHOOK) {
        console.log('FEISHU_WEBHOOK not configured, skipping notification');
        return;
    }

    const { success, wellnessData, activityData, error } = result;

    // Build message content
    let message = '';
    let color = success ? 'green' : 'red';

    if (success) {
        message = `✅ Garmin 数据同步完成\n\n`;

        if (wellnessData) {
            if (wellnessData.skipped) {
                message += `📊 健康数据: 已存在，跳过 (${wellnessData.date})\n`;
            } else if (wellnessData.synced) {
                message += `📊 健康数据: 同步成功 (${wellnessData.date})\n`;
            }
        }

        if (activityData) {
            message += `🏃 活动数据: 新增 ${activityData.synced} 条\n`;
            if (activityData.skipped > 0) {
                message += `   跳过 ${activityData.skipped} 条（已存在）\n`;
            }
        }
    } else {
        message = `❌ Garmin 数据同步失败\n\n`;
        message += `错误: ${error || '未知错误'}`;
    }

    // Send to Feishu
    try {
        await axios.post(FEISHU_WEBHOOK, {
            msg_type: 'text',
            content: {
                text: message
            }
        });
        console.log('Feishu notification sent');
    } catch (e: any) {
        console.error('Failed to send Feishu notification:', e.message);
    }
};

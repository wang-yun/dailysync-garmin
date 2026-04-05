import axios from 'axios';

const FEISHU_APP_ID = process.env.FEISHU_APP_ID;
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET;
const FEISHU_BOT_USER_ID = process.env.FEISHU_BOT_USER_ID;
const FEISHU_CHAT_ID = process.env.FEISHU_CHAT_ID;

interface FeishuTokenResponse {
    code: number;
    msg: string;
    tenant_access_token?: string;
}

interface FeishuSendResponse {
    code: number;
    msg: string;
}

let cachedToken: { token: string; expireTime: number } | null = null;

/**
 * Get Feishu tenant access token
 */
const getAccessToken = async (): Promise<string | null> => {
    // Check cache
    if (cachedToken && Date.now() < cachedToken.expireTime) {
        return cachedToken.token;
    }

    if (!FEISHU_APP_ID || !FEISHU_APP_SECRET) {
        console.log('Feishu APP_ID or APP_SECRET not configured');
        return null;
    }

    try {
        const response = await axios.post<FeishuTokenResponse>(
            'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
            {
                app_id: FEISHU_APP_ID,
                app_secret: FEISHU_APP_SECRET
            }
        );

        if (response.data.code === 0 && response.data.tenant_access_token) {
            // Cache token (expire 30 minutes before actual expiry)
            cachedToken = {
                token: response.data.tenant_access_token,
                expireTime: Date.now() + 110 * 60 * 1000 // 110 minutes
            };
            return cachedToken.token;
        } else {
            console.error('Failed to get Feishu token:', response.data.msg);
            return null;
        }
    } catch (e: any) {
        console.error('Feishu token request failed:', e.message);
        return null;
    }
};

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
 * Send sync result notification to Feishu Bot
 */
export const sendFeishuNotification = async (result: SyncResult): Promise<void> => {
    if (!FEISHU_APP_ID || !FEISHU_APP_SECRET) {
        console.log('Feishu not configured, skipping notification');
        return;
    }

    const { success, wellnessData, activityData, error } = result;

    // Build message content
    let message = '';

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

    // Get access token
    const token = await getAccessToken();
    if (!token) {
        console.error('Cannot send Feishu notification: no token');
        return;
    }

    // Send message
    try {
        const payload: any = {
            msg_type: 'text',
            content: {
                text: message
            }
        };

        let url: string;
        let receiveIdType: string;

        if (FEISHU_BOT_USER_ID) {
            // Send to user by open_id
            payload.receive_id = FEISHU_BOT_USER_ID;
            receiveIdType = 'open_id';
            url = 'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id';
        } else if (FEISHU_CHAT_ID) {
            // Send to chat (group)
            payload.receive_id = FEISHU_CHAT_ID;
            receiveIdType = 'chat_id';
            url = 'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id';
        } else {
            console.log('No receive_id configured (FEISHU_BOT_USER_ID or FEISHU_CHAT_ID)');
            return;
        }

        const response = await axios.post<FeishuSendResponse>(url, payload, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.data.code === 0) {
            console.log('Feishu notification sent successfully');
        } else {
            console.error('Failed to send Feishu notification:', response.data.msg);
        }
    } catch (e: any) {
        console.error('Feishu notification error:', e.message);
        if (e.response?.data) {
            console.error('Response:', JSON.stringify(e.response.data));
        }
    }
};

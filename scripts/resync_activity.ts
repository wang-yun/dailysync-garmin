// 单独同步指定活动到 Google Sheets
// 使用方法:
//   npx tsx scripts/resync_activity.ts <activityId>

import 'dotenv/config';
import { getGaminCNClient } from '../src/utils/garmin_cn';
import { GoogleSheetsService } from '../src/services/GoogleSheetsService';
import { mapActivityFromGarmin } from '../src/utils/garmin_common';

const activityId = process.argv[2];

if (!activityId) {
    console.error('请提供活动ID');
    console.error('用法: npx tsx scripts/resync_activity.ts <activityId>');
    process.exit(1);
}

async function resyncActivity() {
    try {
        console.log(`正在获取活动详情: ${activityId}`);
        
        // 获取 Garmin CN client
        const client = await getGaminCNClient();
        
        // 获取活动详情 - 使用正确的 API
        const activityDetail = await client.getActivity({ activityId: activityId });
        console.log(`活动名称: ${activityDetail.activityName}`);
        console.log(`开始时间: ${activityDetail.startTimeLocal}`);
        
        // 映射数据
        const actMetrics = mapActivityFromGarmin(activityDetail);
        
        // 初始化 Google Sheets 服务
        const sheetsService = new GoogleSheetsService();
        
        // 检查是否已存在
        const hasExisting = await sheetsService.hasActivityData(activityId);
        if (hasExisting) {
            console.log('Google Sheets 中已存在该活动，跳过写入');
            return;
        }
        
        // 写入 Google Sheets
        await sheetsService.appendActivityData(actMetrics);
        console.log(`✅ 成功同步到 Google Sheets: ${activityDetail.activityName}`);
        
    } catch (error: any) {
        console.error('同步失败:', error.message);
        process.exit(1);
    }
}

resyncActivity();

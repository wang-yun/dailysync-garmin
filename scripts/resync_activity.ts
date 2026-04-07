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
        
        // 获取最近的活动列表，找到指定的活动
        // 需要遍历查找，因为 API 不支持直接通过 ID 查询
        let foundActivity = null;
        let page = 0;
        const pageSize = 50;
        
        while (!foundActivity) {
            console.log(`搜索活动列表页 ${page}...`);
            const activities = await client.getActivities(page * pageSize, pageSize);
            
            if (!activities || activities.length === 0) {
                console.error(`未找到活动: ${activityId}`);
                process.exit(1);
            }
            
            foundActivity = activities.find((act: any) => String(act.activityId) === String(activityId));
            
            if (foundActivity) {
                console.log(`找到活动: ${foundActivity.activityName}`);
                console.log(`开始时间: ${foundActivity.startTimeLocal}`);
                break;
            }
            
            page++;
            if (page > 10) { // 最多搜索 500 条
                console.error(`未找到活动: ${activityId}`);
                process.exit(1);
            }
        }
        
        // 映射数据
        const actMetrics = mapActivityFromGarmin(foundActivity);
        
        console.log('活动指标:', JSON.stringify(actMetrics, null, 2));
        
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
        console.log(`✅ 成功同步到 Google Sheets: ${foundActivity.activityName}`);
        
    } catch (error: any) {
        console.error('同步失败:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

resyncActivity();

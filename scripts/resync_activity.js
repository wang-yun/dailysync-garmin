// 单独同步指定活动到 Google Sheets
// 使用方法:
//   node scripts/resync_activity.js <activityId>

require('dotenv/config');
const { getGaminCNClient } = require('../utils/garmin_cn');
const { GoogleSheetsService } = require('../services/GoogleSheetsService');
const { mapActivityFromGarmin } = require('../utils/garmin_common');

const activityId = process.argv[2];

if (!activityId) {
    console.error('请提供活动ID');
    console.error('用法: node scripts/resync_activity.js <activityId>');
    process.exit(1);
}

async function resyncActivity() {
    try {
        console.log(`正在获取活动详情: ${activityId}`);
        
        // 获取 Garmin CN client
        const client = await getGaminCNClient();
        
        // 获取活动详情
        const activityDetail = await client.getActivityDetails(activityId);
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
        
    } catch (error) {
        console.error('同步失败:', error.message);
        process.exit(1);
    }
}

resyncActivity();

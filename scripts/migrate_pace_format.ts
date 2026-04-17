/**
 * 迁移脚本：修正 Google Sheets 中历史数据的配速格式
 * 
 * 问题：之前 avgPace 存的是小数格式（如 6.46），需要改为分秒格式（如 6:28）
 * 
 * 使用方法:
 *   npx tsx scripts/migrate_pace_format.ts
 * 
 * 此脚本为预览模式，会先显示需要修改的记录，不直接写入。
 * 确认后添加 --confirm 参数执行实际写入：
 *   npx tsx scripts/migrate_pace_format.ts --confirm
 */

import { GoogleSheetsService } from '../src/services/GoogleSheetsService';

const CONFIRM = process.argv.includes('--confirm');

/**
 * 将小数格式配速（如 6.46）转换为分秒格式（如 6:28）
 * 6.46 表示 6.46 分钟 = 6 分 + 0.46*60 秒 = 6:27.6 ≈ 6:28
 */
function decimalPaceToMinSec(paceStr: string): string | null {
    if (!paceStr || typeof paceStr !== 'string') return null;
    
    // 检查是否已经是 mm:ss 格式（如 6:28）
    if (paceStr.includes(':')) return null;
    
    // 检查是否是小数格式（如 6.46）
    const pace = parseFloat(paceStr);
    if (isNaN(pace)) return null;
    
    const paceMin = Math.floor(pace);
    const paceSec = Math.round((pace - paceMin) * 60);
    
    // 处理四舍五入到60的情况（如 6:60 -> 7:00）
    if (paceSec === 60) {
        return `${paceMin + 1}:00`;
    }
    
    const paceSecStr = paceSec < 10 ? `0${paceSec}` : `${paceSec}`;
    return `${paceMin}:${paceSecStr}`;
}

async function migrate() {
    const sheetsService = new GoogleSheetsService();
    
    console.log('📊 读取 Activities_Log 数据...');
    
    // 获取所有数据（包含 header）
    const response = await sheetsService.sheets.spreadsheets.values.get({
        spreadsheetId: sheetsService.spreadsheetId,
        range: 'Activities_Log!A:AO',  // 活动数据有约41列
    });
    
    const allValues = response.data.values || [];
    
    if (allValues.length <= 1) {
        console.log('没有数据需要迁移');
        return;
    }
    
    const header = allValues[0];
    console.log(`表头列数: ${header.length}`);
    
    // 找到 avgPace 列（index 10, L列）
    const paceColIndex = header.findIndex((col: string) => 
        col === 'Avg_Pace' || col === 'avgPace' || col === '平均配速'
    );
    
    if (paceColIndex === -1) {
        console.error('未找到 Avg_Pace 列');
        console.log('表头:', header);
        return;
    }
    
    console.log(`Avg_Pace 列位置: 第 ${paceColIndex + 1} 列 (${String.fromCharCode(65 + paceColIndex)})`);
    
    // 分析每行数据
    const rowsToFix: { rowIndex: number; oldValue: string; newValue: string; activityId: string }[] = [];
    
    for (let i = 1; i < allValues.length; i++) {
        const row = allValues[i];
        const paceStr = row[paceColIndex];
        
        if (paceStr) {
            const newValue = decimalPaceToMinSec(String(paceStr));
            if (newValue) {
                rowsToFix.push({
                    rowIndex: i + 1,  // Google Sheets 行号从1开始，+1 因为有header
                    oldValue: String(paceStr),
                    newValue,
                    activityId: row[0] || 'unknown'
                });
            }
        }
    }
    
    console.log(`\n📋 分析结果:`);
    console.log(`总行数: ${allValues.length - 1}`);
    console.log(`需要修正: ${rowsToFix.length} 行`);
    
    if (rowsToFix.length === 0) {
        console.log('✅ 没有需要修正的数据');
        return;
    }
    
    // 预览前10条
    console.log('\n前 10 条需要修正的记录:');
    console.log('------------------------------------------------');
    for (const row of rowsToFix.slice(0, 10)) {
        console.log(`行 ${row.rowIndex}: ID=${row.activityId} | ${row.oldValue} → ${row.newValue}`);
    }
    
    if (rowsToFix.length > 10) {
        console.log(`... 还有 ${rowsToFix.length - 10} 条`);
    }
    
    if (!CONFIRM) {
        console.log('\n⚠️  预览模式，未实际写入');
        console.log('确认后执行: npx tsx scripts/migrate_pace_format.ts --confirm');
        return;
    }
    
    // 实际写入
    console.log('\n✍️  开始写入修正数据...');
    
    let successCount = 0;
    let failCount = 0;
    
    for (const row of rowsToFix) {
        try {
            const range = `Activities_Log!${String.fromCharCode(65 + paceColIndex)}${row.rowIndex}`;
            await sheetsService.sheets.spreadsheets.values.update({
                spreadsheetId: sheetsService.spreadsheetId,
                range,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [[row.newValue]] },
            });
            successCount++;
        } catch (error: any) {
            console.error(`写入失败 行${row.rowIndex}:`, error.message);
            failCount++;
        }
    }
    
    console.log(`\n✅ 迁移完成: 成功 ${successCount} 条, 失败 ${failCount} 条`);
}

// 扩展 GoogleSheetsService 以访问内部 sheets 属性
declare module '../src/services/GoogleSheetsService' {
    class GoogleSheetsService {
        sheets: any;
        spreadsheetId: string;
    }
}

migrate().catch(console.error);

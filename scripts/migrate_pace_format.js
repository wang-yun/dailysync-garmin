/**
 * 迁移脚本：修正 Google Sheets 中历史数据的配速格式
 * 
 * 问题：之前 avgPace 存的是小数格式（如 6.46），需要改为分秒格式（如 6:28）
 * 
 * 使用方法:
 *   node scripts/migrate_pace_format.js           # 预览
 *   node scripts/migrate_pace_format.js --confirm # 执行写入
 */

const { google } = require('googleapis');
const path = require('path');

// 加载环境变量
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SERVICE_ACCOUNT_KEY_PATH = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || path.join(__dirname, '..', process.env.GOOGLE_API_PRIVATE_KEY?.includes('-----BEGIN RSA PRIVATE KEY-----') ? 'gsa-key.json' : 'service_account_key.json');

const CONFIRM = process.argv.includes('--confirm');

/**
 * 将小数格式配速（如 6.46）转换为分秒格式（如 6:28）
 */
function decimalPaceToMinSec(paceStr) {
    if (!paceStr || typeof paceStr !== 'string') return null;
    
    // 已经是 mm:ss 格式，跳过
    if (paceStr.includes(':')) return null;
    
    // 检查是否是小数格式
    const pace = parseFloat(paceStr);
    if (isNaN(pace)) return null;
    
    const paceMin = Math.floor(pace);
    const paceSec = Math.round((pace - paceMin) * 60);
    
    // 四舍五入到60的情况（如 6:60 -> 7:00）
    if (paceSec === 60) {
        return `${paceMin + 1}:00`;
    }
    
    const paceSecStr = paceSec < 10 ? `0${paceSec}` : `${paceSec}`;
    return `${paceMin}:${paceSecStr}`;
}

async function getSheetsClient() {
    let credentials;
    
    // 尝试从文件读取
    try {
        if (require('fs').existsSync(GOOGLE_SERVICE_ACCOUNT_KEY_PATH)) {
            credentials = JSON.parse(require('fs').readFileSync(GOOGLE_SERVICE_ACCOUNT_KEY_PATH, 'utf8'));
        }
    } catch (e) {
        // 尝试直接解析环境变量中的私钥
    }
    
    if (!credentials && process.env.GOOGLE_API_PRIVATE_KEY) {
        credentials = {
            client_email: process.env.GOOGLE_API_CLIENT_EMAIL,
            private_key: process.env.GOOGLE_API_PRIVATE_KEY.replace(/\\n/g, '\n'),
        };
    }
    
    if (!credentials) {
        throw new Error('无法加载 Google Sheets 凭证');
    }
    
    const auth = new google.auth.JWT(
        credentials.client_email,
        null,
        credentials.private_key,
        ['https://www.googleapis.com/auth/spreadsheets']
    );
    
    return google.sheets({ version: 'v4', auth });
}

async function migrate() {
    if (!GOOGLE_SHEET_ID) {
        console.error('错误: 未设置 GOOGLE_SHEET_ID');
        process.exit(1);
    }
    
    console.log('📊 读取 Activities_Log 数据...\n');
    
    const sheets = await getSheetsClient();
    
    // 获取所有数据
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: GOOGLE_SHEET_ID,
        range: 'Activities_Log!A:AO',
    });
    
    const allValues = response.data.values || [];
    
    if (allValues.length <= 1) {
        console.log('没有数据需要迁移');
        return;
    }
    
    const header = allValues[0];
    
    // 找到 Avg_Pace 列
    const paceColIndex = header.findIndex((col) => 
        col === 'Avg_Pace' || col === 'avgPace'
    );
    
    if (paceColIndex === -1) {
        console.error('未找到 Avg_Pace 列');
        console.log('表头:', header);
        return;
    }
    
    const colLetter = String.fromCharCode(65 + paceColIndex);
    console.log(`Avg_Pace 列位置: 第 ${paceColIndex + 1} 列 (${colLetter}列)`);
    console.log(`总行数: ${allValues.length - 1} 条数据\n`);
    
    // 分析需要修正的行
    const rowsToFix = [];
    
    for (let i = 1; i < allValues.length; i++) {
        const row = allValues[i];
        const paceStr = row[paceColIndex];
        
        if (paceStr) {
            const newValue = decimalPaceToMinSec(String(paceStr));
            if (newValue) {
                rowsToFix.push({
                    rowNum: i + 1,
                    oldValue: String(paceStr),
                    newValue,
                    activityId: row[0] || 'unknown'
                });
            }
        }
    }
    
    console.log(`📋 分析结果:`);
    console.log(`需要修正: ${rowsToFix.length} 行\n`);
    
    if (rowsToFix.length === 0) {
        console.log('✅ 没有需要修正的数据');
        return;
    }
    
    // 预览前10条
    console.log('前 10 条需要修正的记录:');
    console.log('-'.repeat(50));
    for (const row of rowsToFix.slice(0, 10)) {
        console.log(`行${row.rowNum}: ID=${row.activityId} | ${row.oldValue} → ${row.newValue}`);
    }
    
    if (rowsToFix.length > 10) {
        console.log(`... 还有 ${rowsToFix.length - 10} 条\n`);
    }
    
    if (!CONFIRM) {
        console.log('\n⚠️  预览模式，未实际写入');
        console.log('确认后执行: node scripts/migrate_pace_format.js --confirm');
        return;
    }
    
    // 批量写入
    console.log('\n✍️  开始写入修正数据...');
    
    // 批量更新（每100行一批）
    const batchSize = 100;
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < rowsToFix.length; i += batchSize) {
        const batch = rowsToFix.slice(i, i + batchSize);
        const ranges = batch.map(row => 
            `Activities_Log!${colLetter}${row.rowNum}`
        );
        
        const data = batch.map(row => ({
            range: `Activities_Log!${colLetter}${row.rowNum}`,
            values: [[row.newValue]]
        }));
        
        try {
            await sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: GOOGLE_SHEET_ID,
                resource: {
                    data,
                    valueInputOption: 'USER_ENTERED',
                },
            });
            successCount += batch.length;
            process.stdout.write(`已处理 ${successCount}/${rowsToFix.length}...\n`);
        } catch (error) {
            console.error(`批量写入失败:`, error.message);
            failCount += batch.length;
        }
    }
    
    console.log(`\n✅ 迁移完成: 成功 ${successCount} 条, 失败 ${failCount} 条`);
}

migrate().catch(err => {
    console.error('迁移失败:', err.message);
    process.exit(1);
});

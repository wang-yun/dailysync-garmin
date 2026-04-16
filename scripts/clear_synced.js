// 清理同步记录脚本
// 使用方法:
//   node scripts/clear_synced.js                    # 清空所有同步记录
//   node scripts/clear_synced.js <activity_id>      # 删除特定活动记录

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'db', 'garmin.db');

const activityId = process.argv[2];

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('连接数据库失败:', err.message);
        process.exit(1);
    }
});

db.serialize(() => {
    // 确保 synced_activities 表存在
    db.run(`CREATE TABLE IF NOT EXISTS synced_activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        activity_id VARCHAR(50) UNIQUE,
        synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('创建表失败:', err.message);
            process.exit(1);
        }
    });

    if (activityId === '--all') {
        // 删除所有记录
        db.run(`DELETE FROM synced_activities`, function(err) {
            if (err) {
                console.error('删除记录失败:', err.message);
                process.exit(1);
            }
            console.log(`已删除所有同步记录 (影响了 ${this.changes} 行)`);
            db.close();
        });
    } else if (activityId) {
        // 删除特定活动记录
        db.run(`DELETE FROM synced_activities WHERE activity_id = ?`, [activityId], function(err) {
            if (err) {
                console.error('删除记录失败:', err.message);
                process.exit(1);
            }
            console.log(`已删除活动记录: ${activityId} (影响了 ${this.changes} 行)`);
            db.close();
        });
    } else {
        // 查询所有记录
        db.all(`SELECT * FROM synced_activities ORDER BY id DESC LIMIT 20`, (err, rows) => {
            if (err) {
                console.error('查询失败:', err.message);
                process.exit(1);
            }
            
            if (rows.length === 0) {
                console.log('没有同步记录需要清理。');
                db.close();
                return;
            }
            
            console.log(`当前共有 ${rows.length} 条同步记录:`);
            rows.forEach(row => {
                console.log(`  - ${row.activity_id} (同步于 ${row.synced_at})`);
            });
            
            console.log('\n如需删除特定记录，请运行:');
            console.log('  node scripts/clear_synced.js <activity_id>');
            console.log('\n如需删除所有记录，请运行:');
            console.log('  node scripts/clear_synced.js --all');
            
            db.close();
        });
    }
});

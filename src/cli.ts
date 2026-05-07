#!/usr/bin/env ts-node
/**
 * DailySync — 统一 CLI 入口
 *
 * Usage:
 *   ts-node src/cli.ts <command> [options]
 *
 * Commands:
 *   sync cn-to-global        日常同步：中国区 → 国际区 + Sheets + 通知
 *   sync global-to-cn        反向同步：国际区 → 中国区
 *   migrate cn-to-global     历史迁移：中国区活动 → 国际区
 *   migrate global-to-cn     历史迁移：国际区活动 → 中国区
 *   migrate cn-to-sheets     历史迁移：中国区活动 → Google Sheets
 *   migrate wellness         历史迁移：中国区健康 → Google Sheets
 *   rq                       RQ 跑力数据采集 → Google Sheets
 *   test sheets              测试 Google Sheets 连接
 *   help                     显示此帮助信息
 */

import 'dotenv/config';

// ── 命令注册 ──
const COMMANDS: Record<string, { fn: () => Promise<any>; desc: string }> = {};

async function loadCommands() {
    const [
        { runSyncCnToGlobal },
        { runSyncGlobalToCn },
        { runMigrateCnToGlobal },
        { runMigrateGlobalToCn },
        { runMigrateCnToSheets },
        { runMigrateWellness },
        { runRq },
    ] = await Promise.all([
        import('./sync_garmin_cn_to_global'),
        import('./sync_garmin_global_to_cn'),
        import('./migrate_garmin_cn_to_global'),
        import('./migrate_garmin_global_to_cn'),
        import('./migrate_garmin_cn_to_sheets'),
        import('./migrate_wellness_to_sheets'),
        import('./rq'),
    ]);

    COMMANDS['sync'] = { fn: runSyncCnToGlobal, desc: '中国区 → 国际区 + Sheets + 通知' };
    COMMANDS['sync:cn-to-global'] = COMMANDS['sync'];
    COMMANDS['sync:global-to-cn'] = { fn: runSyncGlobalToCn, desc: '国际区 → 中国区' };
    COMMANDS['migrate:cn-to-global'] = { fn: runMigrateCnToGlobal, desc: '中国区活动 → 国际区' };
    COMMANDS['migrate:global-to-cn'] = { fn: runMigrateGlobalToCn, desc: '国际区活动 → 中国区' };
    COMMANDS['migrate:cn-to-sheets'] = { fn: runMigrateCnToSheets, desc: '中国区活动 → Google Sheets' };
    COMMANDS['migrate:wellness'] = { fn: runMigrateWellness, desc: '中国区健康 → Google Sheets' };
    COMMANDS['rq'] = { fn: runRq, desc: 'RQ 跑力数据采集 → Google Sheets' };
    COMMANDS['test:sheets'] = {
        fn: async () => {
            const { GoogleSheetsService } = await import('./services/GoogleSheetsService');
            const svc = new GoogleSheetsService();
            await svc.initializeSheets();
            console.log('✅ Google Sheets 连接成功');
        },
        desc: '测试 Google Sheets 连接',
    };
}

function printHelp() {
    console.log(`
用法: ts-node src/cli.ts <command>

命令:
  sync [cn-to-global]       ${COMMANDS['sync']?.desc ?? '中国区 → 国际区'}
  sync global-to-cn         ${COMMANDS['sync:global-to-cn']?.desc ?? '国际区 → 中国区'}
  migrate cn-to-global      ${COMMANDS['migrate:cn-to-global']?.desc ?? ''}
  migrate global-to-cn      ${COMMANDS['migrate:global-to-cn']?.desc ?? ''}
  migrate cn-to-sheets      ${COMMANDS['migrate:cn-to-sheets']?.desc ?? ''}
  migrate wellness           ${COMMANDS['migrate:wellness']?.desc ?? ''}
  rq                         ${COMMANDS['rq']?.desc ?? ''}
  test sheets                ${COMMANDS['test:sheets']?.desc ?? ''}
  help                       显示此帮助信息

环境变量: 参见 .env 或 README.md
`);
}

async function main() {
    await loadCommands();

    const cmd = process.argv[2];

    if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
        printHelp();
        return;
    }

    const entry = COMMANDS[cmd];
    if (!entry) {
        console.error(`❌ 未知命令: "${cmd}"`);
        printHelp();
        process.exit(1);
    }

    try {
        await entry.fn();
        console.log(`\n✅ ${cmd} 执行完成`);
    } catch (e: any) {
        console.error(`\n❌ ${cmd} 执行失败:`, e.message);
        process.exit(1);
    }
}

main();

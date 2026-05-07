#!/usr/bin/env tsx
/**
 * DailySync — 统一 CLI 入口
 *
 * Usage:
 *   tsx src/cli.ts <command> [options]
 *
 * Commands:
 *   sync [cn-to-global]        日常同步：中国区 → 国际区 + Sheets + 通知
 *   sync global-to-cn          反向同步：国际区 → 中国区
 *   migrate cn-to-global       历史迁移：中国区活动 → 国际区
 *   migrate global-to-cn       历史迁移：国际区活动 → 中国区
 *   migrate cn-to-sheets       历史迁移：中国区活动 → Google Sheets
 *   migrate wellness            历史迁移：中国区健康 → Google Sheets
 *   rq                          RQ 跑力数据采集 → Google Sheets
 *   test sheets                 测试 Google Sheets 连接
 *   help                        显示此帮助信息
 */

import 'dotenv/config';

// ── 命令注册（懒加载：仅导入需要的模块） ──

const COMMANDS: Record<string, { load: () => Promise<() => Promise<any>>; desc: string }> = {
    'sync': {
        load: async () => (await import('./sync_garmin_cn_to_global')).runSyncCnToGlobal,
        desc: '中国区 → 国际区 + Sheets + 通知',
    },
    'sync:global-to-cn': {
        load: async () => (await import('./sync_garmin_global_to_cn')).runSyncGlobalToCn,
        desc: '国际区 → 中国区',
    },
    'migrate:cn-to-global': {
        load: async () => (await import('./migrate_garmin_cn_to_global')).runMigrateCnToGlobal,
        desc: '中国区活动 → 国际区',
    },
    'migrate:global-to-cn': {
        load: async () => (await import('./migrate_garmin_global_to_cn')).runMigrateGlobalToCn,
        desc: '国际区活动 → 中国区',
    },
    'migrate:cn-to-sheets': {
        load: async () => (await import('./migrate_garmin_cn_to_sheets')).runMigrateCnToSheets,
        desc: '中国区活动 → Google Sheets',
    },
    'migrate:wellness': {
        load: async () => (await import('./migrate_wellness_to_sheets')).runMigrateWellness,
        desc: '中国区健康 → Google Sheets',
    },
    'rq': {
        load: async () => (await import('./rq')).runRq,
        desc: 'RQ 跑力数据采集 → Google Sheets',
    },
    'test:sheets': {
        load: async () => {
            const { GoogleSheetsService } = await import('./services/GoogleSheetsService');
            return async () => {
                const svc = new GoogleSheetsService();
                await svc.initializeSheets();
                console.log('✅ Google Sheets 连接成功');
            };
        },
        desc: '测试 Google Sheets 连接',
    },
};

// 别名映射
COMMANDS['sync:cn-to-global'] = COMMANDS['sync'];

const HELP_TEXT = `
用法: tsx src/cli.ts <command>

命令:
  sync [cn-to-global]         ${COMMANDS['sync'].desc}
  sync global-to-cn           ${COMMANDS['sync:global-to-cn'].desc}
  migrate cn-to-global        ${COMMANDS['migrate:cn-to-global'].desc}
  migrate global-to-cn        ${COMMANDS['migrate:global-to-cn'].desc}
  migrate cn-to-sheets        ${COMMANDS['migrate:cn-to-sheets'].desc}
  migrate wellness             ${COMMANDS['migrate:wellness'].desc}
  rq                           ${COMMANDS['rq'].desc}
  test sheets                  ${COMMANDS['test:sheets'].desc}
  help                         显示此帮助信息

环境变量: 参见 .env 或 README.md
`;

async function main() {
    const cmd = process.argv[2];

    if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
        console.log(HELP_TEXT);
        return;
    }

    const entry = COMMANDS[cmd];
    if (!entry) {
        console.error(`❌ 未知命令: "${cmd}"`);
        console.log(HELP_TEXT);
        process.exit(1);
    }

    const fn = await entry.load();
    try {
        await fn();
        console.log(`\n✅ ${cmd} 执行完成`);
    } catch (e: any) {
        console.error(`\n❌ ${cmd} 执行失败:`, e.message);
        process.exit(1);
    }
}

main();

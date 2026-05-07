#!/usr/bin/env tsx
/**
 * DailySync — 统一 CLI 入口
 *
 * Usage:
 *   tsx src/cli.ts <command> [options]
 *
 * Commands:
 *   sync [cn-to-global]         日常同步：中国区 → 国际区 + Sheets + 通知
 *   sync global-to-cn           反向同步：国际区 → 中国区
 *   migrate cn-to-global        历史迁移：中国区活动 → 国际区
 *   migrate global-to-cn        历史迁移：国际区活动 → 中国区
 *   migrate cn-to-sheets        中国区活动 → Google Sheets
 *   migrate wellness            中国区健康 → Google Sheets
 *   rq                          RQ 跑力数据采集 → Google Sheets
 *   test sheets                 测试 Google Sheets 连接
 *   help                        显示此帮助信息
 */

import 'dotenv/config';

// ── 简易参数解析 (--key value 或 --key=value) ──
function parseArgs(argv: string[]): Record<string, string> {
    const args: Record<string, string> = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg.startsWith('--')) {
            const eqIdx = arg.indexOf('=');
            if (eqIdx > 0) {
                // --key=value
                args[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1);
            } else {
                const key = arg.slice(2);
                const next = argv[i + 1];
                if (next && !next.startsWith('-')) {
                    args[key] = next;
                    i++;
                } else {
                    args[key] = 'true';
                }
            }
        }
    }
    return args;
}

// ── 命令注册（懒加载） ──

const COMMANDS: Record<string, { load: (args: Record<string, string>) => Promise<() => Promise<any>>; desc: string }> = {
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
        load: async (args) => {
            const mod = await import('./migrate_garmin_cn_to_sheets');
            const activityIds = args['activity-id'] ? args['activity-id'].split(',').map(s => s.trim()).filter(Boolean) : undefined;
            if (activityIds?.length) {
                console.log(`指定的活动 ID: ${activityIds.join(', ')}`);
            }
            return () => mod.runMigrateCnToSheets(activityIds ? { activityIds } : undefined);
        },
        desc: '中国区活动 → Google Sheets（--activity-id 123,456 指定活动ID）',
    },
    'migrate:wellness': {
        load: async (args) => {
            const mod = await import('./migrate_wellness_to_sheets');
            const date = args['date'] || undefined;
            const days = args['days'] ? parseInt(args['days'], 10) : undefined;
            return () => mod.runMigrateWellness({ ...(date ? { date } : {}), ...(days ? { days } : {}) });
        },
        desc: '中国区健康 → Google Sheets（--date 2026-04-04 指定日期，--days 30 指定天数）',
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

// 别名
COMMANDS['sync:cn-to-global'] = COMMANDS['sync'];

const HELP_TEXT = `
用法: tsx src/cli.ts <command> [options]

命令:
  sync [cn-to-global]         ${COMMANDS['sync'].desc}
  sync global-to-cn           ${COMMANDS['sync:global-to-cn'].desc}
  migrate cn-to-global        ${COMMANDS['migrate:cn-to-global'].desc}
  migrate global-to-cn        ${COMMANDS['migrate:global-to-cn'].desc}

  migrate cn-to-sheets        ${COMMANDS['migrate:cn-to-sheets'].desc}
  migrate wellness            ${COMMANDS['migrate:wellness'].desc}

  rq                          ${COMMANDS['rq'].desc}
  test sheets                 ${COMMANDS['test:sheets'].desc}
  help                        显示此帮助信息

参数:
  --activity-id <id>         活动 ID（逗号分隔），如: --activity-id 123456,789012
  --date <YYYY-MM-DD>        指定日期，如: --date 2026-04-04
  --days <N>                 往前追溯天数，如: --days 30

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

    // 解析命令参数（从 argv[3] 开始）
    const args = parseArgs(process.argv.slice(3));

    const fn = await entry.load(args);
    try {
        await fn();
        console.log(`\n✅ ${cmd} 执行完成`);
    } catch (e: any) {
        console.error(`\n❌ ${cmd} 执行失败:`, e.message);
        process.exit(1);
    }
}

main();

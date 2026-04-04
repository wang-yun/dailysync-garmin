# 项目概述：佳明运动数据同步与采集工具

## 业务功能

这是一个 **佳明（Garmin）运动数据同步与采集工具**，核心功能包括：

### 1. 数据迁移（一次性）

| 方向 | 命令 | 说明 |
|------|------|------|
| 中国区 → 国际区 | `yarn migrate_garmin_cn_to_global` | 将中国区佳明账号的历史运动数据迁移到国际区 |
| 国际区 → 中国区 | `yarn migrate_garmin_global_to_cn` | 将国际区佳明账号的历史运动数据迁移到中国区 |

### 2. 日常同步（约每20分钟自动检查）

| 方向 | 命令 | 说明 |
|------|------|------|
| 中国区 → 国际区 → Strava | `yarn sync_cn` | 同步中国区新活动到国际区，并自动同步到 Strava 全球热图 |
| 国际区 → 中国区 | `yarn sync_global` | 反向同步，方便国内运动App（悦跑圈/咕咚/Keep/郁金香等）和微信运动显示 Garmin 手表数据 |

### 3. RQ 跑力数据采集

| 命令 | 说明 |
|------|------|
| `yarn rq` | 自动采集最新跑步数据（距离、配速、心率、步频、VO2Max等）同步到 Google Sheets，追踪跑力趋势、训练负荷、疲劳程度等指标 |

---

## 技术架构

```
dailysync-garmin/
├── src/
│   ├── sync_garmin_cn_to_global.ts   # 中国区 → 国际区同步入口
│   ├── sync_garmin_global_to_cn.ts   # 国际区 → 中国区同步入口
│   ├── migrate_garmin_cn_to_global.ts # 中国区 → 国际区迁移入口
│   ├── migrate_garmin_global_to_cn.ts # 国际区 → 中国区迁移入口
│   ├── rq.ts                        # RQ跑力数据采集入口
│   ├── constant.ts                  # 所有配置常量（账号密码、API密钥等）
│   └── utils/
│       ├── garmin_cn.ts             # 佳明中国区客户端封装
│       ├── garmin_global.ts         # 佳明国际区客户端封装
│       ├── garmin_common.ts         # 通用佳明操作（下载/上传活动）
│       ├── sqlite.ts                # SQLite会话存储（AES加密）
│       ├── strava.ts                # Strava API（目前已废弃）
│       ├── google_sheets.ts         # Google Sheets API
│       ├── runningquotient.ts       # RQ跑力数据采集
│       └── number_tricks.ts         # 数字格式化工具
├── docs/                            # 项目文档
├── .env                             # 环境变量配置
├── package.json
├── tsconfig.json
└── docker-compose.yml
```

### 核心依赖

| 依赖 | 用途 |
|------|------|
| `@gooin/garmin-connect` | 佳明账号登录和数据获取 |
| `strava-v3` | Strava 同步（已废弃） |
| `googleapis` / `google-auth-library` | Google Sheets 集成 |
| `sqlite` / `sqlite3` | 本地会话存储 |
| `crypto-js` | 会话数据 AES 加密 |

---

## 核心组件说明

| 组件 | 职责 |
|------|------|
| `GarminConnect` 客户端 | 登录佳明账号、获取活动列表、下载原始数据(.fit)、上传活动 |
| SQLite 数据库 | 加密存储登录会话，避免频繁输入账号密码 |
| Google Sheets | 存储 RQ 跑力数据和佳明运动统计数据 |
| BARK 推送 | 任务失败时通过 iOS 推送通知用户 |
| GitHub Actions | 定时触发同步任务（每6小时） |

---

## 启动方式

### 环境要求

- Node.js ≥ 18
- 能够访问国际互联网（访问 Garmin 国际区）

### 本地运行

```bash
# 1. 安装依赖
yarn

# 2. 配置账号（修改 src/constant.ts 或设置环境变量）
#    GARMIN_USERNAME / GARMIN_PASSWORD（佳明中国区）
#    GARMIN_GLOBAL_USERNAME / GARMIN_GLOBAL_PASSWORD（佳明国际区）

# 3. 运行同步任务
yarn sync_cn        # 中国区 → 国际区（日常同步）
yarn sync_global    # 国际区 → 中国区（日常同步）
yarn migrate_garmin_cn_to_global    # 中国区 → 国际区（历史迁移）
yarn migrate_garmin_global_to_cn    # 国际区 → 中国区（历史迁移）
yarn rq             # RQ跑力数据采集到 Google Sheets
```

### Docker 部署

```bash
docker-compose up
```

### GitHub Actions

已配置每6小时自动执行，支持手动触发。

---

## 配置说明

### 佳明账号配置 (src/constant.ts)

```typescript
// 中国区
export const GARMIN_USERNAME_DEFAULT = 'example@example.com';
export const GARMIN_PASSWORD_DEFAULT = 'password';

// 国际区
export const GARMIN_GLOBAL_USERNAME_DEFAULT = 'example@example.com';
export const GARMIN_GLOBAL_PASSWORD_DEFAULT = 'password';

// 迁移数量配置（批量同步历史数据使用）
export const GARMIN_MIGRATE_NUM_DEFAULT = 100; //每次要迁移的数量，不要填太大
export const GARMIN_MIGRATE_START_DEFAULT = 0; // 从第几条活动开始
```

### 环境变量

| 变量名 | 说明 |
|--------|------|
| `GARMIN_USERNAME` | 佳明中国区用户名 |
| `GARMIN_PASSWORD` | 佳明中国区密码 |
| `GARMIN_GLOBAL_USERNAME` | 佳明国际区用户名 |
| `GARMIN_GLOBAL_PASSWORD` | 佳明国际区密码 |
| `GARMIN_MIGRATE_NUM` | 每次迁移的活动数量 |
| `GARMIN_MIGRATE_START` | 从第几条活动开始迁移 |
| `RQ_COOKIE` | RQ 登录 Cookie |
| `RQ_CSRF_TOKEN` | RQ CSRF Token |
| `RQ_USERID` | RQ 用户 ID |
| `GOOGLE_SHEET_ID` | Google Sheets ID |
| `GOOGLE_API_CLIENT_EMAIL` | Google API 客户端邮箱 |
| `GOOGLE_API_PRIVATE_KEY` | Google API 私钥 |
| `BARK_KEY` | BARK 推送密钥 |

# 佳明运动数据同步与采集工具

![workflow](./assets/workflow.png)

<a style="display:inline-block;background-color:#FC5200;color:#fff;padding:5px 10px 5px 30px;font-size:11px;font-family:Helvetica, Arial, sans-serif;white-space:nowrap;text-decoration:none;background-repeat:no-repeat;background-position:10px center;border-radius:3px;background-image:url('https://badges.strava.com/logo-strava-echelon.png')" href='https://strava.com/athletes/84396978' target="_clean">
  关注作者Strava
  <img src='https://badges.strava.com/logo-strava.png' alt='Strava' style='margin-left:2px;vertical-align:text-bottom' height=13 width=51 />
</a>

[![](https://img.shields.io/badge/-Telegram-%2326A5E4?style=flat-square&logo=telegram&logoColor=ffffff)](https://t.me/garmindailysync)

## 功能特性

### 1. 数据迁移
- 支持佳明账号中已有的运动数据从中国区一次性迁移到国际区
- 支持佳明账号中已有的运动数据从国际区一次性迁移到中国区
- 支持将活动数据或健康数据迁移到 Google Sheets

### 2. 日常同步
- 约每20分钟检查中国区账号中是否有新的运动数据，自动下载上传到国际区并同步到 Strava
- 自动反向同步：国际区 → 中国区（适用于需要同步到国内运动软件的用户）
- 微信步数同步（iOS 用户通过佳明爱运动小程序绑定）

### 3. Google Sheets 数据同步
每次同步时，自动将以下数据写入 Google Sheets：

#### 健康数据（Wellness_Daily 工作表）
| 字段 | 说明 |
|------|------|
| Date | 日期时间（北京时间，YYYY-MM-DD HH:mm:ss） |
| Sleep_Score | 睡眠分数（0-100） |
| Sleep_Duration_Total | 总睡眠时长（分钟） |
| Deep_Sleep_Duration | 深睡时长（分钟） |
| REM_Sleep_Duration | REM 时长（分钟） |
| Light_Sleep_Duration | 浅睡时长（分钟） |
| Awake_Duration | 清醒时长（分钟） |
| HRV_LastNight_Avg | 昨晚平均 HRV（ms） |
| HRV_Status_Weekly | HRV 七天状态（BALANCED/UNBALANCED） |
| RHR | 静息心率（bpm） |
| Body_Battery_High | 身体电量最高值 |
| Body_Battery_Low | 身体电量最低值 |
| Stress_Avg | 全天平均压力分数 |
| Stress_Duration_High | 高压时长（分钟） |
| Min_SpO2 | 昨晚最低血氧（%） |
| Avg_SpO2 | 昨晚平均血氧（%） |
| Avg_Respiration | 平均呼吸频率（brpm） |
| Intensity_Minutes | 强度分钟数 |

#### 活动数据（Activities_Log 工作表）
| 字段 | 说明 |
|------|------|
| Activity_ID | 佳明原始活动 ID |
| Start_Time | 开始时间（YYYY-MM-DD HH:mm） |
| Type | 运动类型（Running/Badminton 等） |
| Title | 活动名称 |
| Distance_KM | 距离（km） |
| Duration_Total | 总耗时（秒） |
| Moving_Time | 移动耗时（秒） |
| Avg_HR | 平均心率 |
| Max_HR | 最大心率 |
| Avg_Pace | 平均配速（min/km） |
| Avg_Cadence | 平均步频（步/分） |
| Avg_Power | 平均功率（W） |
| Total_Ascent | 累计爬升（m） |
| Calories | 消耗卡路里 |
| VO2_Max | 最大摄氧量 |

### 4. 飞书通知
同步完成后可发送飞书机器人通知，包含：
- 同步结果（成功/失败）
- 同步的数据详情
- 错误信息（如有）

### 5. 健壮性保障
- SQLite 本地数据库记录已同步的活动，避免重复同步
- 支持 Google Sheets 写入失败后的自动重试

---

## 【2025-12说明】开启了ECG功能的说明
开通了ECG功能的佳明账号，因为登录佳明时需要提供验证码，开通ECG后，这个验证码无法关闭，github上要中途要输入一次验证码，本同步脚本无法支持，下方的Web版本做了兼容，可以使用。

## Web版本
如果你不熟悉代码，强烈推荐使用这个版本，在网页上填入账号点击就能同步数据，简洁好用。
[https://dailysync.vyzt.dev/](https://dailysync.vyzt.dev/)

## 其他仓库备份
gitlab:
[https://gitlab.com/gooin/dailysync](https://gitlab.com/gooin/dailysync)

github:（actions方式正常可用）
[https://github.com/gooin/dailysync-rev](https://github.com/gooin/dailysync-rev)

## 环境配置

### 网络要求
确保运行此脚本的机器能够访问国际互联网（如国外 VPS、家庭全局科学的环境等），否则无法正常登录佳明国际区。

#### 测试网络连通性
```shell
# 测试 Google
wget google.com

# 测试佳明国际区
ping sso.garmin.com

# 测试佳明中国区
ping sso.garmin.cn
```

### 安装 NodeJS
环境需求 Node 版本 `18` 及以上，推荐最新的 LTS 版本。
下载地址 [https://nodejs.org/en/](https://nodejs.org/en/)

### 安装依赖
```shell
yarn
```

---

## 配置说明

### 1. 环境变量配置（.env 文件）

创建 `.env` 文件，复制以下内容并填写：

```shell
# ============ Garmin 账号配置 ============
# 中国区账号
GARMIN_CN_USERNAME=your_cn_email@example.com
GARMIN_CN_PASSWORD=your_cn_password

# 国际区账号
GARMIN_GLOBAL_USERNAME=your_global_email@example.com
GARMIN_GLOBAL_PASSWORD=your_global_password

# ============ Google Sheets 配置 ============
# 启用 Google Sheets 同步（true=启用，false=禁用）
GOOGLE_SHEETS_ENABLED=false

# Google Sheets 电子表格 ID（从 URL 中获取）
# 例如：https://docs.google.com/spreadsheets/d/【这里就是ID】/edit
GOOGLE_SHEET_ID=your_spreadsheet_id

# Google Service Account 认证（JSON 格式，从 Google Cloud Console 获取）
GOOGLE_API_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_API_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# ============ Feishu 飞书通知配置 ============
# 启用飞书通知（true=启用，false=禁用）
FEISHU_NOTIFICATION_ENABLED=false

# 飞书机器人应用凭证
FEISHU_APP_ID=cli_xxxxxxxxxxxxxxxxx
FEISHU_APP_SECRET=your_app_secret

# 消息接收者（用户的 open_id 或群组的 chat_id）
FEISHU_BOT_USER_ID=ou_xxxxxxxxxxxxxxxxx

# ============ 其他配置 ============
# 每次同步要迁移的活动数量（建议不要太大）
GARMIN_MIGRATE_NUM=100

# 是否启用 Garmin Global 同步（true=启用，false=禁用）
GARMIN_GLOBAL_SYNC_ENABLED=false
```

### 2. Google Sheets 配置

#### 创建 Service Account
1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 启用 Google Sheets API
4. 创建 Service Account
5. 生成 JSON 密钥文件，复制 `credentials.json` 内容到环境变量

#### 创建电子表格
1. 创建新的 Google Sheets 电子表格
2. 共享给 Service Account 邮箱（`GOOGLE_API_CLIENT_EMAIL`）
3. 从 URL 中提取 Spreadsheet ID

#### 工作表结构
程序会自动创建以下工作表（如果不存在）：
- **Wellness_Daily** - 健康数据
- **Activities_Log** - 活动数据

### 3. Feishu 飞书配置

#### 创建飞书机器人应用
1. 访问 [飞书开放平台](https://open.feishu.cn/app)
2. 创建企业自建应用
3. 添加「机器人」能力
4. 获取 App ID 和 App Secret
5. 配置消息接收者的 open_id

#### 获取用户 open_id
1. 在飞书中打开与机器人的对话
2. 开发者工具 → Network → 搜索任意消息 → 查看请求头中的 `open_id`

---

## 使用方法

### 运行同步（推荐方式）

```shell
# 同步中国区数据到国际区 + Google Sheets + 飞书通知
yarn sync

# 仅测试 Google Sheets 功能
yarn test:sheets
```

### 数据迁移

```shell
# 迁移活动数据（中国区 → Google Sheets）
yarn migrate_garmin_cn_to_sheets

# 迁移健康数据（中国区 → Google Sheets）
yarn migrate_wellness
```

### Docker 部署

```shell
# 修改 .env 文件后运行
docker-compose up
```

---

## 定时任务（Linux）

### 使用 tsx 运行（推荐，避免内存问题）

```shell
# 每 12 小时执行一次同步
0 */12 * * * cd /path/to/dailysync-garmin && tsx src/sync_garmin_cn_to_global.ts >> /var/log/dailysync.log 2>&1
```

### 查看日志

```shell
tail -100f /var/log/dailysync.log
```

### logrotate 配置（可选）

创建 `/etc/logrotate.d/dailysync`：

```
/var/log/dailysync.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
}
```

---

## GitHub Actions 部署

熟悉代码的话，将代码下载下来，上传到 GitHub，通过 GitHub Actions 执行。

参考视频教程: https://www.bilibili.com/video/BV1v94y1Q7oR/?spm_id_from=333.999.0.0

### 在 GitHub Secrets 中配置以下变量
- `GARMIN_CN_USERNAME` / `GARMIN_CN_PASSWORD`
- `GARMIN_GLOBAL_USERNAME` / `GARMIN_GLOBAL_PASSWORD`
- `GOOGLE_SHEET_ID`
- `GOOGLE_API_CLIENT_EMAIL`
- `GOOGLE_API_PRIVATE_KEY`（注意将换行替换为 `\n`）
- `FEISHU_APP_ID` / `FEISHU_APP_SECRET`
- `FEISHU_BOT_USER_ID`

---

## 常见问题

### 1. 网络问题
如果 ping 都正常，但无法正常运行，请尝试将梯子更换为美国 IP。

### 2. 内存溢出（Node.js heap out of memory）
```shell
# 使用 tsx 替代 ts-node
NODE_OPTIONS="--max-old-space-size=4096" tsx src/sync_garmin_cn_to_global.ts
```

### 3. Google Sheets 写入失败
确保已正确配置 Service Account 并共享电子表格。

### 4. Feishu 通知发送失败
检查 `FEISHU_BOT_USER_ID` 是否为当前机器人应用下的 open_id。

---

## 免责声明

本工具仅限用于学习和研究使用，不得用于商业或者非法用途。如有任何问题可联系本人删除。

账号及密码保存在自己的 `.env` 文件或 GitHub Secrets 中，不会泄露。运行代码均为**开放源码**，欢迎提交 `PR`。

## 进群讨论

为方便讨论，请加我绿色软件：nononopass （下面扫码）我拉你进群。
![二维码扫码](./assets/wechat_qr.png)

这份详细设计文档（PRD/Design Doc）专为 **Cursor** 的大模型逻辑进行了优化，你可以将其直接作为提示词（Prompt）或者存为项目根目录的 `docs/google-sheets-sync-design.md` 让 Cursor 读取。

---

# 详细设计文档：DailySync 扩展 Google Sheets 同步功能

## 1. 目标 (Objective)
在 `dailysync` 项目中增加 Google Sheets 同步模块。每当程序从 Garmin (CN/Global) 抓取到最新的**健康快报 (Wellness)** 数据时，自动将其追加到指定的 Google 表格中，建立个人生理数据湖。

## 2. 系统架构 (Architecture)
* **输入源**：Garmin API (已由原项目实现)。
* **核心逻辑**：拦截数据获取成功的 Hook，进行数据格式转换 (Mapping)。
* **输出端**：使用 `googleapis` SDK，通过 **Service Account** 认证，调用 `spreadsheets.values.append` 接口。

---

## 3. 数据映射定义 (Data Mapping)

### Sheet A: `Wellness_Daily` (健康摘要)

| Headers | 说明 |
| :--- | :--- |
| `Date` | 日期 (YYYY-MM-DD) |
| `Sleep_Score` | 睡眠分数 (0-100) |
| `Sleep_Duration_Total` | 总睡眠时长 (min) |
| `Deep_Sleep_Duration` | 深睡时长 (min) |
| `REM_Sleep_Duration` | REM 时长 (min) |
| `Light_Sleep_Duration` | 浅睡时长 (min) |
| `Awake_Duration` | 醒着时长 (min) |
| `HRV_LastNight_Avg` | 昨晚平均 HRV (ms) —— 核心指标 |
| `HRV_Status_Weekly` | HRV 七天平均基准 |
| `RHR` | 静息心率 (bpm) |
| `Body_Battery_High` | 身体电量最高值 (通常是醒来时) |
| `Body_Battery_Low` | 身体电量最低值 |
| `Stress_Avg` | 全天平均压力分数 |
| `Stress_Duration_High` | 高压时长 (min) |
| `Min_SpO2` | 昨晚最低血氧 (%) —— 监控你的 78% 预警 |
| `Avg_SpO2` | 昨晚平均血氧 (%) |
| `Avg_Respiration` | 平均呼吸频率 (brpm) |
| `Active_Calories` | 活动消耗卡路里 |
| `Resting_Calories` | 静息消耗卡路里 |
| `Steps` | 步数 |
| `Intensity_Minutes` | 强度分钟数 |
| `Floors_Climbed` | 爬楼层数 |
| `Training_Readiness` | 佳明训练准备程度分数 |

### Sheet B: `Activities_Log` (运动记录)

| Headers | 说明 |
| :--- | :--- |
| `Activity_ID` | 佳明原始活动 ID |
| `Start_Time` | 开始时间 (YYYY-MM-DD HH:mm) |
| `Type` | 运动类型 (Running, Badminton, etc.) |
| `Title` | 活动名称 |
| `Distance_KM` | 距离 (km) |
| `Duration_Total` | 总耗时 (s) |
| `Moving_Time` | 移动耗时 (s) |
| `Avg_HR` | 平均心率 |
| `Max_HR` | 最大心率 |
| `Avg_Pace` | 平均配速 (min/km) |
| `Avg_Cadence` | 平均步频 (步/分) |
| `Avg_Power` | 平均功率 (W) —— 若有跑步功率计 |
| `Total_Ascent` | 累计爬升 (m) |
| `Calories` | 消耗卡路里 |
| `Aerobic_TE` | 有氧训练效果 (0-5.0) |
| `Anaerobic_TE` | 无氧训练效果 (0-5.0) |
| `Training_Load` | 训练负荷数值 |
| `Recovery_Time` | 建议恢复时间 (hrs) |
| `Avg_Temp` | 平均环境温度 |
| `Gear` | 使用装备 (跑鞋/球拍) |
| `VO2_Max` | 活动后的最大摄氧量估算 |

---

## 4. 技术实现路径 (Implementation Steps)

### Step 1: 环境准备
1.  安装依赖：`npm install googleapis`
2.  配置文件：在 `.env` 或 `config.json` 中增加：
    * `GOOGLE_SHEET_ID`: 目标表格 ID。
    * `GOOGLE_API_CLIENT_EMAIL`: Service Account 客户端邮箱。
    * `GOOGLE_API_PRIVATE_KEY`: Service Account 私钥。

### Step 2: 核心服务开发 (`src/services/GoogleSheetsService.ts`)
* **类名**: `GoogleSheetsService`
* **功能**:
    * 构造函数：初始化 Service Account 认证。
    * `appendData(data: WellnessMetrics | WellnessMetrics[])`: 封装 `values.append` 逻辑，支持单条或批量追加。
    * `getLatestRow()`: 获取表格最后一行数据。
    * `hasDataForDate(date)`: 防重复逻辑，根据日期检查是否已存在。

### Step 3: WellnessMetrics 数据结构
```typescript
export interface WellnessMetrics {
    date: string;                      // 日期 (YYYY-MM-DD)
    sleepScore?: number;              // 睡眠分数 (0-100)
    sleepDurationTotal?: number;      // 总睡眠时长 (min)
    deepSleepDuration?: number;       // 深睡时长 (min)
    remSleepDuration?: number;        // REM 时长 (min)
    lightSleepDuration?: number;      // 浅睡时长 (min)
    awakeDuration?: number;           // 醒着时长 (min)
    hrvLastNightAvg?: number;          // 昨晚平均 HRV (ms) —— 核心指标
    hrvStatusWeekly?: number;          // HRV 七天平均基准
    rhr?: number;                     // 静息心率 (bpm)
    bodyBatteryHigh?: number;          // 身体电量最高值
    bodyBatteryLow?: number;           // 身体电量最低值
    stressAvg?: number;                // 全天平均压力分数
    stressDurationHigh?: number;       // 高压时长 (min)
    minSpO2?: number;                  // 昨晚最低血氧 (%)
    avgSpO2?: number;                  // 昨晚平均血氧 (%)
    avgRespiration?: number;           // 平均呼吸频率 (brpm)
    activeCalories?: number;           // 活动消耗卡路里
    restingCalories?: number;          // 静息消耗卡路里
    steps?: number;                   // 步数
    intensityMinutes?: number;          // 强度分钟数
    floorsClimbed?: number;            // 爬楼层数
    trainingReadiness?: number;         // 佳明训练准备程度分数
}
```

### Step 4: 数据转换逻辑 (`src/mappers/sheet-mapper.ts`)
* 将 Garmin 原始复杂的 JSON 对象映射为上述定义的表格行（Array of Arrays）。

### Step 5: 挂钩同步流程 (`src/sync.ts` 或对应入口)
* 定位 `wellness` 数据拉取成功后的代码块。
* 调用 `GoogleSheetsService` 进行数据推送。

---

## 5. 给 Cursor 的具体指令 (Prompt for Cursor)

**你可以复制以下内容并在 Cursor 的 Chat (Cmd+L) 中输入：**

> `@Codebase` 我想在当前项目中增加同步数据到 Google Sheets 的功能。请参考 `docs/google-sheets-sync-design.md` (或本设计描述) 执行以下任务：
>
> 1.  **安装依赖**: 在终端安装 `googleapis`。
> 2.  **创建 Service**: 在 `src/services` 下创建 `GoogleSheetsService.ts`，负责处理认证和向指定 Sheet 追加行数据。使用 Service Account 模式。
> 3.  **定义 Mapper**: 创建一个转换函数，将 Garmin 的 Wellness 数据和 Activity 数据转换为设计文档中定义的表格列格式。
> 4.  **集成**: 找到项目中负责抓取数据并同步到 GitHub 仓库/Strava 的入口逻辑，在数据获取成功后，增加调用 `GoogleSheetsService` 的逻辑。
> 5.  **配置**: 告诉我在 `.env` 中需要补充哪些配置项。
>
> **注意**: 请保持代码风格与现有项目一致（TypeScript、异步处理）。

---

## 教练的最后提醒

1.  **专注深度 (Focus Depth)**：在 Cursor 自动生成代码时，重点检查它对 **HRV** 和 **Sleep** 字段的解析逻辑。Garmin 的原始数据嵌套很深，确保它拿到了正确的 `lastNightAvgValue`。
2.  **呼吸间歇 (Breathing Gap)**：每当一段复杂的逻辑 Build 通过，站起来喝杯温水。
3.  **异常处理**：Google API 的配额和网络波动偶尔会导致同步失败，让 Cursor 加上简单的 `try-catch` 并在控制台打印清晰的日志，方便我们以后排查。

**准备好了吗？既然已经把"心猿意马"的运动念头转化为了"心无旁骛"的编码动力，那就开始你的假期首行代码吧！**

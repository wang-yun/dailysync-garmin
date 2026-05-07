// ============================================================================
// Domain Models — 统一领域模型
// ============================================================================

export type GarminClientType = import('@gooin/garmin-connect').GarminConnect;

// ────── Wellness Metrics (健康摘��) ──────

export interface WellnessMetrics {
    date: string;                        // 日期 (YYYY-MM-DD)
    timestamp?: string;                  // 数据插入时间 (YYYY-MM-DD HH:mm:ss)
    sleepScore?: number;                 // 睡眠分数 (0-100)
    sleepDurationTotal?: number;         // 总睡眠时长 (min)
    deepSleepDuration?: number;          // 深睡时长 (min)
    remSleepDuration?: number;           // REM 时长 (min)
    lightSleepDuration?: number;         // 浅睡时长 (min)
    awakeDuration?: number;              // 醒着时长 (min)
    hrvLastNightAvg?: number;            // 昨晚平均 HRV (ms)
    hrvStatusWeekly?: string;            // HRV 七天状态
    rhr?: number;                        // 静息心率 (bpm)
    bodyBatteryHigh?: number;            // 身体电量最高值
    bodyBatteryLow?: number;             // 身体电量最低值
    stressAvg?: number;                  // 全天平均压力分数
    stressDurationHigh?: number;         // 高压时长 (min)
    minSpO2?: number;                    // 昨晚最低血氧 (%)
    avgSpO2?: number;                    // 昨晚平均血氧 (%)
    avgRespiration?: number;             // 平均呼吸频率 (brpm)
    activeCalories?: number;             // 活动消耗卡路里
    restingCalories?: number;            // 静息消耗卡路里
    steps?: number;                      // 步数
    intensityMinutes?: number;           // 强度分钟数
    floorsClimbed?: number;              // 爬楼层数
    trainingReadiness?: number;          // 佳明训练准备程度分数
}

// ────── Activity Metrics (运动记录) ──────

export interface ActivityMetrics {
    activityId: string;                    // 佳明原始活动 ID
    startTime: string;                     // 开始时间 (YYYY-MM-DD HH:mm)
    type: string;                          // 运动类型
    title?: string;                        // 活动名称
    locationName?: string;                 // 位置名称
    distanceKm?: number;                   // 距离 (km)
    durationTotal?: number;                // 总耗时 (s)
    movingTime?: number;                   // 移动耗时 (s)
    avgHr?: number;                        // 平均心率
    maxHr?: number;                        // 最大心率
    avgPace?: string;                      // 平均配速 (min/km, mm:ss)
    maxSpeed?: number;                     // 最大速度 (m/s)
    avgCadence?: number;                   // 平均步频 (步/分)
    maxCadence?: number;                   // 最大步频
    avgPower?: number;                     // 平均功率 (W)
    avgVerticalOscillation?: number;       // 垂直振幅 (cm)
    avgVerticalRatio?: number;             // 垂直振幅比 (%)
    avgGroundContactTime?: number;         // 触地时间 (ms)
    avgGroundContactBalance?: number;      // 触地平衡 (%)
    avgStrideLength?: number;              // 步幅 (cm)
    totalAscent?: number;                  // 累计爬升 (m)
    calories?: number;                     // 消耗卡路里
    steps?: number;                        // 步数
    aerobicTe?: number;                    // 有氧训练效果 (0-5.0)
    anaerobicTe?: number;                  // 无氧训练效果 (0-5.0)
    trainingLoad?: number;                 // 训练负荷数值
    recoveryTime?: number;                 // 建议恢复时间 (hrs)
    avgTemp?: number;                      // 平均环境温度
    gear?: string;                          // 使用装备
    vo2Max?: number;                        // 最大摄氧量
    avgRespiration?: number;                // 平均呼吸频率 (brpm)
}

// ────── Sync Result (同步结果) — 供 sync 函数返回 ──────

export interface SyncGarminResult {
    success: boolean;
    wellnessDate?: string;
    wellnessSkipped?: boolean;
    wellnessMetrics?: WellnessMetrics;
    activityMetrics?: ActivityMetrics[];
    activitySynced?: number;
    activitySkipped?: number;
    error?: string;
}

// ────── Feishu Notification (飞书通知参数) ──────

export interface FeishuNotificationData {
    success: boolean;
    wellnessData?: {
        date: string;
        timestamp: string;
        synced: boolean;
        skipped: boolean;
        metrics?: WellnessMetrics;
    };
    activityData?: {
        count: number;
        synced: number;
        skipped: number;
        activities?: ActivityMetrics[];
    };
    error?: string;
}

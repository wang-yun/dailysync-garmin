import fs from 'fs';

const core = require('@actions/core');
import {
    DOWNLOAD_DIR,
    FILE_SUFFIX,
    GARMIN_MIGRATE_NUM_DEFAULT,
    GARMIN_MIGRATE_START_DEFAULT,
    GARMIN_PASSWORD_DEFAULT,
    GARMIN_URL_DEFAULT,
    GARMIN_USERNAME_DEFAULT,
} from '../constant';
import { GarminClientType } from './type';
import { ActivityMetrics, WellnessMetrics } from '../services/GoogleSheetsService';
import _ from 'lodash';
const decompress = require('decompress');

const unzipper = require('unzipper');

/**
 * 上传 .fit file
 * @param fitFilePath
 * @param client
 */
export const uploadGarminActivity = async (fitFilePath: string, client: GarminClientType): Promise<void> => {
    if (!fs.existsSync(DOWNLOAD_DIR)) {
        fs.mkdirSync(DOWNLOAD_DIR);
    }
    try {
        const upload = await client.uploadActivity(fitFilePath);
        console.log('upload to garmin activity', upload);
    } catch (error) {
        console.log('upload to garmin activity error', error);
    }
};

/**
 * 下载 garmin 活动原始数据，并解压保存到本地
 * @param activityId
 * @param client GarminClientType
 */
export const downloadGarminActivity = async (activityId, client: GarminClientType): Promise<string> => {
    if (!fs.existsSync(DOWNLOAD_DIR)) {
        fs.mkdirSync(DOWNLOAD_DIR);
    }
    const activity = await client.getActivity({ activityId: activityId });
    await client.downloadOriginalActivityData(activity, DOWNLOAD_DIR);
    const originZipFile = DOWNLOAD_DIR + '/' + activityId + '.zip';
    const baseFilePath = `${DOWNLOAD_DIR}/`;
    const unzipped = await decompress(originZipFile, DOWNLOAD_DIR);
    const unzippedFileName = unzipped?.[0].path;
    const path = baseFilePath + unzippedFileName;
    console.log('downloadGarminActivity - path:', path)
    return path;
};

export const getGarminStatistics = async (client: GarminClientType): Promise<Record<string, any>> => {
    // Get a list of default length with most recent activities
    const acts = await client.getActivities(0, 10);
    // console.log('acts', acts);

    //  跑步 typeKey: 'running'
    //  操场跑步 typeKey: 'track_running'
    //  跑步机跑步 typeKey: 'treadmill_running'
    //  沿街跑步 typeKey: 'street_running'

    // 包含running关键字的都算
    const recentRunningAct = _.filter(acts, act => act?.activityType?.typeKey?.includes('running'))[0];
    console.log('recentRunningAct type: ', recentRunningAct.activityType?.typeKey);

    const {
        activityId, // 活动id
        activityName, // 活动名称
        startTimeLocal, // 活动开始时间
        distance, // 距离
        duration, // 时间
        averageSpeed, // 平均速度 m/s
        averageHR, // 平均心率
        maxHR, // 最大心率
        averageRunningCadenceInStepsPerMinute, // 平均每分钟步频
        aerobicTrainingEffect, // 有氧效果
        anaerobicTrainingEffect, // 无氧效果
        avgGroundContactTime, // 触地时间
        avgStrideLength, // 步幅
        vO2MaxValue, // VO2Max
        avgVerticalOscillation, // 垂直振幅
        avgVerticalRatio, // 垂直振幅比
        avgGroundContactBalance, // 触地平衡
        trainingEffectLabel, // 训练效果
        activityTrainingLoad, // 训练负荷
    } = recentRunningAct;

    const pace = 1 / (averageSpeed / 1000 * 60);
    const pace_min = Math.floor(1 / (averageSpeed / 1000 * 60));
    const pace_second = (pace - pace_min) * 60;
    // 秒数小于10前面添加0， 如01，避免谷歌表格识别不成分钟数。  5:9 -> 5:09
    const pace_second_text = pace_second < 10 ? '0' + pace_second.toFixed(0) : pace_second.toFixed(0);
    // console.log('pace', pace);
    // console.log('pace_min', pace_min);
    // console.log('pace_second', pace_second);

    return {
        activityId, // 活动id
        activityName, // 活动名称
        startTimeLocal, // 活动开始时间
        distance, // 距离
        duration, // 持续时间
        // averageSpeed 是 m/s
        averageSpeed, // 速度
        averagePace: pace,  // min/km
        averagePaceText: `${pace_min}:${pace_second_text}`,  // min/km
        averageHR, // 平均心率
        maxHR, // 最大心率
        averageRunningCadenceInStepsPerMinute, // 平均每分钟步频
        aerobicTrainingEffect, // 有氧效果
        anaerobicTrainingEffect, // 无氧效果
        avgGroundContactTime, // 触地时间
        avgStrideLength, // 步幅
        vO2MaxValue, // 最大摄氧量
        avgVerticalOscillation, // 垂直振幅
        avgVerticalRatio, // 垂直振幅比
        avgGroundContactBalance, // 触地平衡
        trainingEffectLabel, // 训练效果
        activityTrainingLoad, // 训练负荷
        activityURL: GARMIN_URL_DEFAULT.ACTIVITY_URL + activityId, // 活动链接
    };
    // const detail = await GCClient.getActivity(recentRunningAct);
    // console.log('detail', detail);
};

/**
 * Fetch wellness (health) data from Garmin CN for a specific date
 * Uses garmin.cn specific wellness APIs via connectapi.garmin.cn
 */
export const getGarminWellnessData = async (client: GarminClientType, date: Date): Promise<WellnessMetrics> => {
    const dateString = date.toISOString().split('T')[0];

    try {
        console.log(`Fetching wellness data for ${dateString}...`);

        const internalClient = (client as any).client;
        if (!internalClient) {
            console.log('No internal client found');
            return { date: dateString };
        }

        // Get user profile to get garminGUID
        const profile = await client.getUserProfile();
        const garminGUID = profile.garminGUID;

        if (!garminGUID) {
            console.log('No garminGUID found in profile');
            return { date: dateString };
        }

        const baseApiUrl = 'https://connectapi.garmin.cn';

        // Fetch dailySleepData which contains most wellness metrics
        const sleepDataUrl = `${baseApiUrl}/wellness-service/wellness/dailySleepData/${garminGUID}`;
        const sleepDataResult = await internalClient.get(sleepDataUrl, { params: { date: dateString } });

        if (!sleepDataResult || typeof sleepDataResult !== 'object') {
            console.log('Invalid sleep data response');
            return { date: dateString };
        }

        const dailySleep = sleepDataResult.dailySleepDTO || {};
        const sleepScores = dailySleep.sleepScores?.overall || {};
        const sleepMovement = sleepDataResult.sleepMovement || [];
        const sleepStress = sleepDataResult.sleepStress || [];
        const sleepBodyBattery = sleepDataResult.sleepBodyBattery || [];

        // Calculate sleep duration in minutes
        const sleepDurationTotal = dailySleep.sleepTimeSeconds ? Math.round(dailySleep.sleepTimeSeconds / 60) : undefined;

        // Calculate body battery high/low
        let bodyBatteryHigh: number | undefined;
        let bodyBatteryLow: number | undefined;
        if (sleepBodyBattery && sleepBodyBattery.length > 0) {
            const values = sleepBodyBattery.map((e: any) => e.value);
            bodyBatteryHigh = Math.max(...values);
            bodyBatteryLow = Math.min(...values);
        }

        // Calculate average stress from sleep stress data
        let stressAvg: number | undefined;
        let stressDurationHigh = 0;
        if (sleepStress && sleepStress.length > 0) {
            const stressValues = sleepStress.map((e: any) => e.value);
            stressAvg = Number((stressValues.reduce((a: number, b: number) => a + b, 0) / stressValues.length).toFixed(1));
            // Count moments with stress > 50 (high stress)
            stressDurationHigh = sleepStress.filter((e: any) => e.value > 50).length;
        }

        // Calculate intensity minutes from sleep movement
        let intensityMinutes = 0;
        if (sleepMovement && sleepMovement.length > 0) {
            // Moderate: 3-6 MET, Vigorous: > 6 MET (approximate)
            intensityMinutes = sleepMovement.filter((e: any) => e.value >= 3).length;
        }

        // Build the wellness metrics object
        const result: WellnessMetrics = {
            date: dateString,
            // Sleep metrics
            sleepScore: sleepScores.value ?? dailySleep.sleepScore,
            sleepDurationTotal,
            deepSleepDuration: dailySleep.deepSleepSeconds ? Math.round(dailySleep.deepSleepSeconds / 60) : undefined,
            remSleepDuration: dailySleep.remSleepSeconds ? Math.round(dailySleep.remSleepSeconds / 60) : undefined,
            lightSleepDuration: dailySleep.lightSleepSeconds ? Math.round(dailySleep.lightSleepSeconds / 60) : undefined,
            awakeDuration: dailySleep.awakeSleepSeconds ? Math.round(dailySleep.awakeSleepSeconds / 60) : undefined,
            // HRV
            hrvLastNightAvg: sleepDataResult.avgOvernightHrv,
            hrvStatusWeekly: sleepDataResult.hrvStatus,
            // Heart rate
            rhr: sleepDataResult.restingHeartRate,
            // Body Battery
            bodyBatteryHigh,
            bodyBatteryLow,
            // Stress
            stressAvg,
            stressDurationHigh,
            // SpO2
            minSpO2: dailySleep.lowestSpO2Value,
            avgSpO2: dailySleep.averageSpO2Value,
            // Respiration
            avgRespiration: dailySleep.averageRespirationValue,
            // Activity metrics (these come from activity data, not wellness)
            activeCalories: undefined,
            restingCalories: undefined,
            steps: undefined,
            intensityMinutes,
            floorsClimbed: undefined,
            trainingReadiness: undefined,
        };

        console.log('Wellness data fetched:', result);
        return result;
    } catch (error) {
        console.error('Error fetching wellness data:', error);
        return { date: dateString };
    }
};

/**
 * Map activity data from Garmin to ActivityMetrics format
 */
export const mapActivityFromGarmin = (activity: Record<string, any>): ActivityMetrics => {
    const {
        activityId,
        startTimeLocal,
        activityType,
        activityName,
        distance,
        duration,
        movingDuration,
        averageHR,
        maxHR,
        averageSpeed,
        averageRunningCadenceInStepsPerMinute,
        aerobicTrainingEffect,
        anaerobicTrainingEffect,
        activityTrainingLoad,
        totalAscent,
        calories,
        vO2MaxValue,
    } = activity;

    const avgPace = averageSpeed ? (1 / (averageSpeed / 1000 * 60)).toFixed(2) : undefined;

    return {
        activityId: String(activityId),
        startTime: startTimeLocal,
        type: activityType?.typeKey ?? 'unknown',
        title: activityName,
        distanceKm: distance ? distance / 1000 : undefined,
        durationTotal: duration ? Math.round(duration) : undefined,
        movingTime: movingDuration ? Math.round(movingDuration) : undefined,
        avgHr: averageHR,
        maxHr: maxHR,
        avgPace,
        avgCadence: averageRunningCadenceInStepsPerMinute,
        avgPower: undefined,
        totalAscent,
        calories,
        aerobicTe: aerobicTrainingEffect,
        anaerobicTe: anaerobicTrainingEffect,
        trainingLoad: activityTrainingLoad,
        recoveryTime: undefined,
        avgTemp: undefined,
        gear: undefined,
        vo2Max: vO2MaxValue,
    };
};

import { getGaminGlobalClient } from './garmin_global';
import {
    AESKEY_DEFAULT,
    GARMIN_MIGRATE_NUM_DEFAULT,
    GARMIN_MIGRATE_START_DEFAULT,
    GARMIN_PASSWORD_DEFAULT,
    GARMIN_USERNAME_DEFAULT,
    GARMIN_SYNC_NUM_DEFAULT
} from '../constant';
import { downloadGarminActivity, getGarminWellnessData, mapActivityFromGarmin, uploadGarminActivity } from './garmin_common';
import { GarminClientType } from './type';
import { number2capital } from './number_tricks';
const core = require('@actions/core');
import _ from 'lodash';
import { getSessionFromDB, initDB, saveSessionToDB, updateSessionToDB } from './sqlite';
import { GoogleSheetsService } from '../services/GoogleSheetsService';

const CryptoJS = require('crypto-js');
const fs = require('fs');

const { GarminConnect } = require('@gooin/garmin-connect');

const GOOGLE_SHEETS_ENABLED = process.env.GOOGLE_SHEETS_ENABLED === 'true';

const GARMIN_USERNAME = process.env.GARMIN_USERNAME ?? GARMIN_USERNAME_DEFAULT;
const GARMIN_PASSWORD = process.env.GARMIN_PASSWORD ?? GARMIN_PASSWORD_DEFAULT;
const GARMIN_MIGRATE_NUM = process.env.GARMIN_MIGRATE_NUM ?? GARMIN_MIGRATE_NUM_DEFAULT;
const GARMIN_MIGRATE_START = process.env.GARMIN_MIGRATE_START ?? GARMIN_MIGRATE_START_DEFAULT;
const GARMIN_SYNC_NUM = process.env.GARMIN_SYNC_NUM ?? GARMIN_SYNC_NUM_DEFAULT;

export const getGaminCNClient = async (): Promise<GarminClientType> => {
    if (_.isEmpty(GARMIN_USERNAME) || _.isEmpty(GARMIN_PASSWORD)) {
        const errMsg = '请填写中国区用户名及密码：GARMIN_USERNAME,GARMIN_PASSWORD';
        core.setFailed(errMsg);
        return Promise.reject(errMsg);
    }

    const GCClient = new GarminConnect({username: GARMIN_USERNAME, password: GARMIN_PASSWORD}, 'garmin.cn');

    try {
        await initDB();

        const currentSession = await getSessionFromDB('CN');
        if (!currentSession) {
            await GCClient.login();
            await saveSessionToDB('CN', GCClient.exportToken());
        } else {
            //  Wrap error message in GCClient, prevent terminate in github actions.
            try {
                console.log('GarminCN: login by saved session');
                await GCClient.loadToken(currentSession.oauth1, currentSession.oauth2);
            } catch (e) {
                console.log('Warn: renew  GarminCN Session..');
                await GCClient.login(GARMIN_USERNAME, GARMIN_PASSWORD);
                await updateSessionToDB('CN', GCClient.sessionJson);
            }

        }

        const userInfo = await GCClient.getUserProfile();
        const { fullName, userName: emailAddress, location } = userInfo;
        if (!fullName) {
            throw Error('佳明中国区登录失败')
        }
        console.log('Garmin userInfo CN: ', { fullName, emailAddress, location });

        return GCClient;
    } catch (err) {
        console.error(err);
        core.setFailed(err);
    }
};

export const migrateGarminCN2GarminGlobal = async (count = 200) => {
    const actIndex = Number(GARMIN_MIGRATE_START) ?? 0;
    // const actPerGroup = 10;
    const totalAct = Number(GARMIN_MIGRATE_NUM) ?? count;

    const clientCN = await getGaminCNClient();
    const clientGlobal = await getGaminGlobalClient();

    const actSlices = await clientCN.getActivities(actIndex, totalAct);
    // only running
    // const runningActs = _.filter(actSlices, { activityType: { typeKey: 'running' } });

    const runningActs = actSlices;
    for (let j = 0; j < runningActs.length; j++) {
        const act = runningActs[j];
        // console.log({ act });
        // 下载佳明原始数据
        const filePath = await downloadGarminActivity(act.activityId, clientCN);
        // 上传到佳明国际区
        console.log(`本次开始向国际区上传第 ${number2capital(j + 1)} 条数据，相对总数上传到 ${number2capital(j + 1 + actIndex)} 条，  【 ${act.activityName} 】，开始于 【 ${act.startTimeLocal} 】，活动ID: 【 ${act.activityId} 】`);
        await uploadGarminActivity(filePath, clientGlobal);
        // await new Promise(resolve => setTimeout(resolve, 2000));
    }
};

export const syncGarminCN2GarminGlobal = async () => {
    const clientCN = await getGaminCNClient();
    const clientGlobal = await getGaminGlobalClient();

    let cnActs = await clientCN.getActivities(0, Number(GARMIN_SYNC_NUM));
    const globalActs = await clientGlobal.getActivities(0, 1);
    const latestGlobalActStartTime = globalActs[0]?.startTimeLocal ?? '0';
    const latestCnActStartTime = cnActs[0]?.startTimeLocal ?? '0';

    let sheetsService: GoogleSheetsService | null = null;
    if (GOOGLE_SHEETS_ENABLED) {
        try {
            sheetsService = new GoogleSheetsService();
            await sheetsService.initializeSheets();
            console.log('Google Sheets initialized.');
        } catch (e) {
            console.error('Failed to initialize Google Sheets:', e.message);
        }
    }

    // 同步健康数据到 Google Sheets
    if (sheetsService) {
        const today = new Date();
        const wellnessData = await getGarminWellnessData(clientCN, today);
        const hasExistingWellness = await sheetsService.hasWellnessDataForDate(wellnessData.date);
        if (!hasExistingWellness && Object.keys(wellnessData).length > 1) {
            await sheetsService.appendData(wellnessData);
            console.log(`健康数据已同步到 Google Sheets: ${wellnessData.date}`);
        } else if (hasExistingWellness) {
            console.log(`健康数据已存在，跳过: ${wellnessData.date}`);
        } else {
            console.log(`健康数据无内容或获取失败: ${wellnessData.date}`);
        }
    }

    // 同步活动数据到 Garmin Global 和 Google Sheets
    if (latestCnActStartTime === latestGlobalActStartTime) {
        console.log(`没有要同步的活动内容, 最近的活动: 【 ${cnActs[0]?.activityName} 】, 开始于: 【 ${latestCnActStartTime} 】`);
    } else {
        _.reverse(cnActs);
        let actualNewActivityCount = 1;
        for (let i = 0; i < cnActs.length; i++) {
            const cnAct = cnActs[i];
            if (cnAct.startTimeLocal > latestGlobalActStartTime) {
                const filePath = await downloadGarminActivity(cnAct.activityId, clientCN);
                console.log(`本次开始向国际区上传第 ${number2capital(actualNewActivityCount)} 条数据，【 ${cnAct.activityName} 】，开始于 【 ${cnAct.startTimeLocal} 】，活动ID: 【 ${cnAct.activityId} 】`);
                await uploadGarminActivity(filePath, clientGlobal);

                if (sheetsService) {
                    const activityMetrics = mapActivityFromGarmin(cnAct);
                    const hasExisting = await sheetsService.hasActivityData(String(cnAct.activityId));
                    if (!hasExisting) {
                        await sheetsService.appendActivityData(activityMetrics);
                        console.log(`活动数据已同步到 Google Sheets: ${cnAct.activityId}`);
                    } else {
                        console.log(`活动已存在，跳过: ${cnAct.activityId}`);
                    }
                }

                await new Promise(resolve => setTimeout(resolve, 1000));
                actualNewActivityCount++;
            }
        }
    }
};

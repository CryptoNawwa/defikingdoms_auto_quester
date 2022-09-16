import moment from "moment";
import {Bank} from "../bank/bank";
import { Erc20 } from "../blockchain/erc20";
import {
    IGlobalBotConfig,
    IGlobalQuestStatus,
    IGlobalReward, IJewelSwap,
    IStartableQuest,
    IStartableQuestSoon, ISwapPool, ISwapReport,
    ServerQuest,
} from "../constants/types";
import { Dex } from "../dex/dex";
import {Gardens} from "../gardens/gardens";
import {QuestManager} from "../questManager/questManager";

export class Global {

    public RPC_ERRORS: any[];
    public SWITCH_COUNTER: number;
    public GARDENS_HANDLER: Gardens;
    public DEX_HANDLER: Dex;
    public QUEST_HANDLER: QuestManager;
    public BANK_HANDLER: Bank;

    public JEWEL_HANDLER: Erc20;

    public QUESTS_STATUS: IGlobalQuestStatus;
    public REWARDS: IGlobalReward[];

    public SWAPS: ISwapReport[];

    public autoSellMiningRewards = false;
    public autoStakeMiningRewards = false;

    public rsTelegramCmdCalledDate: moment.Moment;
    public profitTelegramCmdCalledDate: moment.Moment;

    constructor() {
        this.RPC_ERRORS = [];
        this.SWITCH_COUNTER = 0;

        this.GARDENS_HANDLER = undefined;
        this.QUEST_HANDLER = undefined;
        this.DEX_HANDLER = undefined;
        this.JEWEL_HANDLER = undefined;

        this.rsTelegramCmdCalledDate = moment();
        this.profitTelegramCmdCalledDate = moment();

        this.REWARDS = [];
        this.SWAPS = [];
        this.autoSellMiningRewards = false;
    }

    public updateAllStatus({serverQuests, completedQuests, launchedQuests, soonStartableQuests}: {
        serverQuests: ServerQuest,
        completedQuests: any[],
        launchedQuests: IStartableQuest[],
        soonStartableQuests: IStartableQuestSoon[],
    }) {

        this.QUESTS_STATUS = {
            serverQuests,
            completedQuests,
            launchedQuests,
            soonStartableQuests,
        };
        return ;
    }

    public getSwapPreferences(cfg: IGlobalBotConfig): {info: IJewelSwap, preferredPool: ISwapPool } {
        return {
            info : cfg.jewelSwap,
            preferredPool: cfg.jewelSwap.swapPools.find((p) => p.name === cfg.jewelSwap.preferredSwap) ?? cfg.jewelSwap.swapPools[0],
        };
    }

}

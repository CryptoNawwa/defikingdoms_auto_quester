import Bluebird from "bluebird";
import _ from "lodash";
import moment from "moment";
import { DFKLogger, GLOBAL } from "../app";
import { Blockchain } from "../blockchain/blockchain";
import config from "../config/config.json";
import { IGlobalBotConfig, IGlobalReward, IStartableQuest, IStartableQuestSoon, QUEST_NAME_TO_TYPE_MAP, QuestType, RewardType, RPC_ISSUES_REASONS, SERVER_ERROR_CODES, ServerQuest, SWAP_TYPE } from "../constants/types";
import { TransactionError } from "../error/transactionError";
import { QuestManager } from "../questManager/questManager";
import { countTotalRewardsByType, msToTime } from "../utils/utils";

export class Bot {

    private questManager: QuestManager;
    private blockchain: Blockchain;

    private readonly cfg: IGlobalBotConfig;

    constructor(questManager: QuestManager, blockchain: Blockchain, cfg) {
        this.blockchain = blockchain;
        this.questManager = questManager;
        this.cfg = cfg as IGlobalBotConfig;
    }

    public async run() {
        try {
            // 1 - Get all quests (running, active, completed)
            const serverQuests = await this.questManager.getAllQuests();

            // 2 - Complete quests
            const completedQuests = await this.questManager.completeQuests(serverQuests.completed);

            // 3 - Try to auto-sell or auto-stake mining rewards if enabled
            if (completedQuests.length > 0 && (GLOBAL.autoSellMiningRewards || GLOBAL.autoStakeMiningRewards)) {
                await this.tryToSellOrStakeMiningRewards(completedQuests);
            }

            // 3 - Start quests if possible
            const [launchedQuests, soonStartableQuests] = await this.questManager.tryToStartQuests();

            // 5 - Update all status for telegram commands
            GLOBAL.updateAllStatus({serverQuests, completedQuests, launchedQuests, soonStartableQuests});

            // 6 - Check if you have heroes able to level up
            await this.doYouHaveHeroesAbleToLevelUp();

            // 7 - Call getAllQuest again to fetch fresh data
            const updatedServerQuests =  await this.questManager.getAllQuests(true);

            // 8 - Re-run the bot as soon as needed
            await this.runAgain(soonStartableQuests, launchedQuests, updatedServerQuests);

        } catch (err) {
            DFKLogger.log.trace(`Error when running bot\n`, err);
            await this.handleBotError(err);
        }
    }

    private async doYouHaveHeroesAbleToLevelUp() {
        const allMyActivatedHeroes = config.quests.filter((q) => q.activated).flatMap((q) => q.heroTeam).flatMap((ht) => ht.heroes).slice(0, 30);

        await Bluebird.map(allMyActivatedHeroes, async (hero, index) => {
            const formatted = await GLOBAL.QUEST_HANDLER.getHeroFormattedData(await GLOBAL.QUEST_HANDLER.getHeroData(hero));
            const maxXp = (formatted.level * 1000) + 1000;

            if (formatted.xp >= maxXp) {
                DFKLogger.log.info(`\nHero [${formatted.hero}], currently level ${formatted.level} has ${formatted.xp}/${maxXp} exp and is ready to ✨✨ level up ✨✨`);
            }
        });

    }

    private async tryToSellOrStakeMiningRewards(completedQuests) {
        const lastRewards: IGlobalReward[] = _.takeRight( GLOBAL.REWARDS, completedQuests.length);

        const rewards = countTotalRewardsByType(lastRewards.filter((r) => QUEST_NAME_TO_TYPE_MAP[r.questName] === QuestType.MINING_JEWEL)).find((r) => r.type === RewardType.JEWEL);
        if (!rewards || rewards.total <= 0) {
            return ;
        }

        const totalJewelReceived = Number(rewards.total.toFixed(3));

        const walletBalance = await GLOBAL.JEWEL_HANDLER.balanceOf(config.wallet.address);

        if (totalJewelReceived < 0 || totalJewelReceived > Number(walletBalance)) {
            return ;
        }

        if (GLOBAL.autoSellMiningRewards) {
            const preferences =  GLOBAL.getSwapPreferences(config);
            DFKLogger.log.info(`The bot will try to sell the ${totalJewelReceived} x Jewels for ${preferences.preferredPool.name}...`);

            const [sentence, hashTx, soldAmount] = await GLOBAL.DEX_HANDLER.swapJewels(totalJewelReceived, preferences);
            if (!sentence || !hashTx || !soldAmount) {
                return ;
            }

            GLOBAL.SWAPS.push({jewelSold: totalJewelReceived, soldForAmount: Number(soldAmount), soldForName: preferences.preferredPool.name, type: SWAP_TYPE.AUTO, date: moment()});

        } else if (GLOBAL.autoStakeMiningRewards) {
            DFKLogger.log.info(`The bot will try to stake ${totalJewelReceived} Jewels in the bank...`);
            await GLOBAL.BANK_HANDLER.stake(totalJewelReceived);
        }

    }

    private async runAgain(soonStartableQuest: IStartableQuestSoon[], launchedQuest: IStartableQuest[], serverQuests: ServerQuest) {
        if (launchedQuest?.length > 0 && launchedQuest.map((q) => q.type)
            .some((type) => type === QuestType.FORAGING || type === QuestType.FISHING)) {
            DFKLogger.log.info(`Foraging or Fishing quest was launched... Bot will wait ${msToTime(this.cfg.pollingIntervalInstantQuest)} and complete quest(s)...`);
            setTimeout(() => this.run(), this.cfg.pollingIntervalInstantQuest);
            return ;
        }

        const [closestQuestToStart] = soonStartableQuest.sort((a, b) => a.heroReadyForQuestAt - b.heroReadyForQuestAt);
        const [closestQuestToComplete] = serverQuests.running;

        const dateInMsToRunAgain: number = (closestQuestToStart?.heroReadyForQuestAt && closestQuestToComplete?.completeAtTime ?
            Math.min(closestQuestToStart.heroReadyForQuestAt, Number(closestQuestToComplete.completeAtTime) * 1000) : closestQuestToStart?.heroReadyForQuestAt ?
                closestQuestToStart.heroReadyForQuestAt : closestQuestToComplete?.completeAtTime ? Number(closestQuestToComplete.completeAtTime) * 1000 : moment().add(this.cfg.pollingIntervalQuest, "ms").valueOf()) + 60000;

        let toWaitInMs = moment(new Date(dateInMsToRunAgain)).diff(new Date());
        if (toWaitInMs <= 0) {
            toWaitInMs = this.cfg.pollingIntervalQuest + 60000;
        }

        setTimeout(() => this.run(), toWaitInMs);
        DFKLogger.log.info(`Waiting for ${msToTime(toWaitInMs)}... - Bot wil run again at ${moment(dateInMsToRunAgain).format("MMMM Do YYYY, h:mm:ss a")} `);
    }

    private async handleBotError(err) {
        if (this.cfg.fallbackRpcOnError) {
            await this.handleRpcFallback(err);
        }

        let toWait = this.cfg.pollingIntervalError;
        if ( GLOBAL.SWITCH_COUNTER >= this.cfg.maximumSwitchBeforeAddingDelay) {
            GLOBAL.SWITCH_COUNTER = 0;
            toWait = this.cfg.pollingIntervalError * 10;
            DFKLogger.log.warn(`Too many un-successful switches, will wait more.`);
        }

        DFKLogger.log.info(`Err : Bot will run again in ${msToTime(toWait)}`);
        setTimeout(() => this.run(), toWait);
    }

    /**
     * Handle server error and fallback to other RPC if errors >= numberOfErrorBeforeFallBack
     * @param error
     * @private
     */
    private async handleRpcFallback(error) {
        if (error instanceof TransactionError || RPC_ISSUES_REASONS.includes(error.reason) || SERVER_ERROR_CODES.includes(error.code)) {
            GLOBAL.RPC_ERRORS.push({code: error.code, reason: error.reason, body: error.body});

            if (GLOBAL.RPC_ERRORS.length >= this.cfg.numberOfErrorBeforeFallBack) {
                await this.blockchain.fallback();
            }
        }
    }

}

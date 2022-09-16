/* tslint:disable:no-string-literal */
// tslint:disable:max-classes-per-file
import Bluebird from "bluebird";
import * as _ from "lodash";
import {uniq} from "lodash";
import moment from "moment";
import {DFKLogger, GLOBAL} from "../app";
import {Blockchain} from "../blockchain/blockchain";
import {
    additionalQuestDataType,
    IGlobalBotConfig, IHeroesWallet,
    IHeroTeam,
    IQuestConfig, IReward,
    IStartableQuest, IStartableQuestSoon,
    QUEST_ADDR_TO_TYPE_MAP,
    QUEST_TYPE_TO_NAME_MAP,
    QuestType,
    REWARD_NAME_TO_TYPE_MAP,
    RewardType,
    ServerQuest,
    ZERO_ADDRESS,
} from "../constants/types";
import {calculateRemainingStamina, delay, getRewardReadable, mFormat, staminaDiffToTime} from "../utils/utils";

export class QuestManager {

    private static getRewardAsObj(rewardString: string, type: RewardType, amount: number = -1): IReward {
        return {
            amount,
            rewardType: type,
            rewardString,
        };
    }

    private blockchain: Blockchain;
    private cfg: IGlobalBotConfig;

    constructor(blockchain: Blockchain, cfg: IGlobalBotConfig) {
        this.blockchain = blockchain;
        this.cfg = cfg;
    }

    public async getAllQuests(silent: boolean = false): Promise<ServerQuest> {

        if (!silent) {
            DFKLogger.log.info("Checking for quests...");
        }

        const serverQuests: ServerQuest = new ServerQuest();

        const activeQuests: any[] = await this.blockchain.questContract.getActiveQuests(
            this.cfg.wallet.address,
        );

        const runningQuests: any[] = activeQuests.filter(
            (quest) => quest.completeAtTime >= Math.round(Date.now() / 1000),
        ).sort((a, b) => a.completeAtTime - b.completeAtTime);

        const completedQuests: any[] = _.difference(activeQuests, runningQuests);

        serverQuests.running = runningQuests;
        serverQuests.completed = completedQuests;
        serverQuests.active = _.difference(activeQuests, [...runningQuests, ...completedQuests]);

        if (!silent) {
            DFKLogger.log.info(`\nFound ${serverQuests.completed.length} completed quest.\nFound ${serverQuests.running.length} running quest.\nFound ${serverQuests.active.length} active quest.`);

            runningQuests.forEach((q, index) => {
                DFKLogger.log.silly(`-> ${QUEST_TYPE_TO_NAME_MAP[QUEST_ADDR_TO_TYPE_MAP[String(q.quest).toUpperCase()]]} quest to complete the ${mFormat(moment(Number(q.completeAtTime) * 1000))}`);
            });

            console.log("\n");
        }

        return serverQuests;
    }

    public async completeQuests(quests: any[]): Promise<any[]> {
        if (!quests || quests.length <= 0) {
            return [];
        }

        DFKLogger.log.info("Checking for quest to complete...");

        const completedQuest = [];
        for (const quest of quests) {
            const heroId = quest.heroes[0];

            DFKLogger.log.silly(`Trying to complete quest led by hero ${heroId}`);

            const receipt = await this.blockchain.tryTransaction(() =>
                    this.blockchain.questContract.connect(this.blockchain.wallet).completeQuest(heroId, this.cfg.gas), 2);

            DFKLogger.log.info(`Quest was completed by hero ${heroId}`);

            this.displayQuestRewards(receipt, quest);
            completedQuest.push(completedQuest);

            await delay(300);
        }

        return completedQuest;
        console.log("\n");
    }
    // throw to main
    public async startQuestOnBlockchain(quests: IStartableQuest[]): Promise<IStartableQuest[]>  {

        const launchedQuest: IStartableQuest[] = [];
        for (const quest of quests) {

            DFKLogger.log.info(`Starting ${quest.quest.name} quest with team ${quest.team.name} - [${quest.heroesReady}]...`);

            switch (quest.type) {
                case QuestType.GARDENING:
                    await this.startQuestWithData(quest);
                    launchedQuest.push(quest);
                    break;
                case QuestType.MINING_GOLD:
                case QuestType.MINING_JEWEL:
                    await this.startQuestWithoutData(quest);
                    launchedQuest.push(quest);
                    break;
                case QuestType.FORAGING:
                case QuestType.FISHING:
                    await this.startQuestWithoutData(quest, Math.floor(quest.lowestStamina / 5));
                    launchedQuest.push(quest);
                    break;
                default:
                    DFKLogger.log.warn(`Quest ${quest.quest.contractAddress} not supported.`);
            }
        }
        console.log("\n");
        return launchedQuest;
    }

    public displayQuestRewards(rewards, quest: any) {
        const rewardsArray: IReward[] = [];

        const xpEvents = rewards.events.filter((e) => e.event === "QuestXP");
        const xpReceived = xpEvents.reduce((total, result) => total + Number(result.args.xpEarned), 0);
        rewardsArray.push(QuestManager.getRewardAsObj(`\nXP: ${xpReceived}`, RewardType.XP, xpReceived));

        const suEvents = rewards.events.filter((e) => e.event === "QuestSkillUp");
        const skillUpReceived = (suEvents.reduce((total, result) => total + Number(result.args.skillUp), 0) / 10);
        rewardsArray.push(QuestManager.getRewardAsObj(`SkillUp: ${skillUpReceived}`, RewardType.SKILLUP, skillUpReceived));

        const rwEvents = rewards.events.filter((e) => e.event === "QuestReward");

        rwEvents.forEach((result) => {
            const desc = getRewardReadable(result.args.rewardItem);

            if (desc === "Jewel") {
                const jewelReceived = Number(result.args.itemQuantity / 1000000000000000000);
                rewardsArray.push(QuestManager.getRewardAsObj(`${jewelReceived} x ${desc}`, RewardType.JEWEL, jewelReceived));
            } else if (desc === "Gold") {
                const goldReceived = Number(result.args.itemQuantity / 1000);
                rewardsArray.push(QuestManager.getRewardAsObj( `${goldReceived} x ${desc}`, RewardType.GOLD, goldReceived));
            } else if (desc !== "Nothing") {
                const otherReceived = Number(result.args.itemQuantity);
                rewardsArray.push(QuestManager.getRewardAsObj(`${otherReceived} x ${desc}`, REWARD_NAME_TO_TYPE_MAP[desc], otherReceived));
            }
        });

        DFKLogger.log.info(rewardsArray.map((r) => r.rewardString).join("\n"));
        GLOBAL.REWARDS.push({questName: QUEST_TYPE_TO_NAME_MAP[QUEST_ADDR_TO_TYPE_MAP[String(quest.quest).toUpperCase()]], rewards: rewardsArray, date: moment()});
    }

    public async getHeroData(hero): Promise<any> {
        return this.blockchain.questContract.getHero(hero);
    }

    // throw to main
    public async tryToStartQuests(): Promise<[IStartableQuest[], IStartableQuestSoon[]]> {

        DFKLogger.log.info("Checking for quest to start...");

        const questIWantToDo = this.cfg.quests.filter((q) => q.activated);
        const positiveStaminaHeroes: IHeroesWallet[] = await
            this.getHeroesWithPositiveStamina(questIWantToDo.flatMap((t) => t.heroTeam).flatMap((h) => h.heroes));

        const startableQuests: IStartableQuest[] = [];
        const soonStartableQuest: IStartableQuestSoon[] = [];

        if (!positiveStaminaHeroes || positiveStaminaHeroes.length <= 0) {
            DFKLogger.log.warn(`You don't have any heroes with enough stamina. Will not start any quest.`);
            return [startableQuests, soonStartableQuest];
        }

        console.log("\n");
        DFKLogger.log.silly(`Trying to launch quests : [${questIWantToDo.map((q) => q.name).join(", ")}]\n`);

        for (const questToDo of questIWantToDo) {
            for (const team of questToDo.heroTeam) {
                const heroesOfCurrentTeam = positiveStaminaHeroes.filter((h) => team.heroes.includes(h.hero));

                const heroesAvailable = heroesOfCurrentTeam
                    .filter((h) => h.stamina >= team.minStaminaRequired)
                    .filter((h) => !h.isQuesting);

                if (heroesAvailable.length >= team.minTeamSize) {
                    startableQuests.push({
                        quest: questToDo,
                        team,
                        type: QUEST_ADDR_TO_TYPE_MAP[questToDo.contractAddress.toUpperCase()],
                        lowestStamina : [...heroesAvailable].sort((a, b) => a.stamina - b.stamina)[0].stamina,
                        heroesReady: heroesAvailable.map((h) => h.hero),
                    });
                } else {
                    soonStartableQuest.push(this.handleUnavailableHeroes(heroesOfCurrentTeam, team, questToDo));
                }
                console.log("\n");
            }
        }

        return [await this.startQuestOnBlockchain(startableQuests), soonStartableQuest.filter((q) => q)];
    }

    public getHeroFormattedData(heroInfo): IHeroesWallet {

        const maxStam: number = Number(heroInfo[4].stamina);
        const fullAt: moment.Moment = moment(Number(heroInfo[3].staminaFullAt) * 1000);

        const isHeroFullStamina = moment(fullAt).isBefore(moment(new Date()));

        const questType = QUEST_ADDR_TO_TYPE_MAP[String(heroInfo[3].currentQuest).toUpperCase()];

        const stamina: number = Number(isHeroFullStamina ? maxStam : calculateRemainingStamina(fullAt, maxStam));

        const isQuesting = questType !== QuestType.NONE && questType !== undefined;

        return {hero: Number(heroInfo[0]), xp: Number(heroInfo[3].xp), level: Number(heroInfo[3].level), isHeroFullStamina, questType, isQuesting, stamina, fullAt: Number(heroInfo[3].staminaFullAt) * 1000};
    }

    private handleUnavailableHeroes(heroOfCurrentTeam: IHeroesWallet[], team: IHeroTeam, questToDo: IQuestConfig): IStartableQuestSoon {
        const heroesNotStaminaReady = heroOfCurrentTeam
            .filter((h) => h.stamina < team.minStaminaRequired)
            .filter((h) => !h.isQuesting)
            .sort((a, b) => a.stamina - b.stamina);

        const heroesOnQuest = heroOfCurrentTeam
            .filter((h) => h.isQuesting);

        const heroesNumberFormat = uniq([...heroesNotStaminaReady.map((h) => h.hero), ...heroesOnQuest.map((h) => h.hero)]);
        DFKLogger.log.warn(`Can't start quest ${questToDo.name} with team ${team.name}, [${heroesNumberFormat.join()}] unavailable.`);

        heroesNotStaminaReady.forEach((h) => {
            DFKLogger.log.silly(`-> Hero [${h.hero}] has ${h.stamina}/${team.minStaminaRequired} stamina - Will be ready the ${mFormat(staminaDiffToTime(team.minStaminaRequired, h.stamina))}`);
        });
        heroesOnQuest.forEach((h) => {
            DFKLogger.log.silly(`-> Hero [${h.hero}] is busy questing.`);
        });

        const [heroIWait] = heroesNotStaminaReady;
        if (heroIWait?.stamina && heroesOnQuest.length <= 0) {
            return {
                quest: questToDo,
                heroReadyForQuestAt: staminaDiffToTime(team.minStaminaRequired, heroIWait.stamina).valueOf(),
                heroFullAt: heroIWait.fullAt,
                heroQuesting : heroesOnQuest,
                heroStaminaNotReady: heroesNotStaminaReady,

            };
        }
    }

    private async startQuestWithData(quest: IStartableQuest) {
        if (!quest.team.gardenId || quest.team.gardenId <= 0) {
            DFKLogger.log.silly(`No gardenId found - can't launch quest.`);
            return ;
        }

        const additionalData: additionalQuestDataType = [quest.team.gardenId, 0, 0, 0, 0, 0, "", "", ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS];

        const tx = await this.blockchain.questContract.connect(this.blockchain.wallet).startQuestWithData(quest.heroesReady, quest.quest.contractAddress, 1, additionalData, this.cfg.gas);
        const receipt = await tx.wait();
        if (receipt.status !== 1) {
            throw new Error(`Error startQuestWithData - Receipt had a status of ${receipt.status}`);
        }
        DFKLogger.log.info(`Quest ${quest.quest.name} started successfully!`);
    }

    private async startQuestWithoutData(quest: IStartableQuest, questGroupSize: number = 1)  {
        DFKLogger.log.silly(`Quest ${quest.quest.name} --> [${questGroupSize}] attempts.`);

        await this.blockchain.tryTransaction(() => this.blockchain.questContract.connect(this.blockchain.wallet)
            .startQuest(quest.heroesReady, quest.quest.contractAddress, questGroupSize, this.cfg.gas), 2);

        DFKLogger.log.info(`Quest ${quest.quest.name} started successfully!`);
    }

    private async getHeroesWithPositiveStamina(allHeroes: number[]): Promise<IHeroesWallet[]> {
        if (!allHeroes || allHeroes.length <= 0) {
            return undefined;
        }

        return Bluebird.map(allHeroes, async (hero, index) => {

            const heroInfo = await this.getHeroData(hero);
            const formatted = this.getHeroFormattedData(heroInfo);

            if (formatted.isQuesting) {
                DFKLogger.log.silly(`Hero [${hero}] is already questing on ${QUEST_TYPE_TO_NAME_MAP[formatted.questType]} quest.`);
            } else if (formatted.isHeroFullStamina) {
                DFKLogger.log.silly(`Hero [${hero}] has ${formatted.stamina} stamina.`);
            } else {
                DFKLogger.log.silly(`Hero [${hero}] has ${formatted.stamina} stamina and will be full at ${moment(formatted.fullAt).format("MMMM Do YYYY, h:mm:ss a")}`);
            }

            return formatted;

            }, {concurrency: 1}).filter((h) => h && h.stamina > 0);
    }
}

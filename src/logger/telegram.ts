import Bluebird from "bluebird";
import _, { uniq } from "lodash";
import moment from "moment";
import { Telegraf } from "telegraf";
import { DFKLogger, GLOBAL } from "../app";
import config from "../config/config.json";
import { ISwapReport, QUEST_ADDR_TO_TYPE_MAP, QUEST_TYPE_TO_NAME_MAP, SWAP_TYPE } from "../constants/types";
import { countTotalRewardsForDisplay, mFormat } from "../utils/utils";

let GLOBAL_ALREADY_CLAIMING = false;

const JEWEL_SELL_ALL_CMD = "SELL_ALL";
const JEWEL_STAKE_ALL_CMD = "STAKE_ALL";

export class TelegramBot {

    public telegraph: Telegraf;

    constructor() {
        this.telegraph = new Telegraf(config.telegramBotToken as string);
    }

    public async start() {

        this.telegraph.start((ctx) => ctx.reply("Welcome BRO ❤️"));

        // List rewards for the last 10 quest
        this.telegraph.command("rewards", this.rewardsLastTen);
        this.telegraph.command("r", this.rewardsLastTen);

        // Status of current heroes
        this.telegraph.command("hr", this.heroesStatus);
        this.telegraph.command("heroes_report", this.heroesStatus);

        // Status of current quests
        this.telegraph.command("qr", this.questsStatus);
        this.telegraph.command("quests_report", this.questsStatus);

        // Status of current profit
        this.telegraph.command("pr", this.profitReport);
        this.telegraph.command("profit_report", this.profitReport);

        // List rewards for the last 24 hours quest
        this.telegraph.command("rewards_day", this.rewardsDay);
        this.telegraph.command("rd", this.rewardsDay);

        // Bank Balance
        this.telegraph.command("bank_balance", this.bankBalance);
        this.telegraph.command("bb", this.bankBalance);

        // List rewards since last /rs call
        this.telegraph.command("rewards_since", this.rewardsSince);
        this.telegraph.command("rs", this.rewardsSince);

        this.telegraph.command("ping", (ctx) => ctx.reply("pong 🎾"));
        this.telegraph.command("exit_bot", () => {
            process.kill(process.pid, "SIGTERM");
        });

        // Balance
        this.telegraph.command("balance", this.balance);
        this.telegraph.command("b", this.balance);

        // Swap jewels for coins
        this.telegraph.command("swap_jewels", this.swapJewels);
        this.telegraph.command("sj", this.swapJewels);

        // Stake jewels in bank
        this.telegraph.command("stake_jewel", this.stakeJewels);
        this.telegraph.command("stj", this.stakeJewels);

        this.telegraph.command("claim", this.claimRewards);
        this.telegraph.command("help", async (ctx) => {
            ctx.reply("Available cmd :\n" +
                "/ping: Answer with pong, used to check if bot is still alive\n" +
                "/rewards or /r : Display rewards of last 10 quests\n" +
                "/rewards_since or /rs : Display rewards since last /rs command\n" +
                "/rewards_day or /rd : Display rewards of the last 24 hours\n" +
                "/claim : Claim garden rewards (need to setup cfg file with gardens ids)\n" +
                "/sell_rewards_off : Disable auto-selling of rewards\n" +
                "/sell_rewards_on : Enable auto-selling of rewards\n" +
                "/stake_rewards_off : Disable auto-staking of rewards\n" +
                "/stake_rewards_on : Enable auto-staking of rewards\n" +
                "/balance or /b : Display current Jewel balance\n" +
                "/bank_balance or /bb : Display current bank Jewel balance\n" +
                "/sj [jewel_amount] : Swap jewel amount for stable coins\n" +
                `/sj ${JEWEL_SELL_ALL_CMD} : Swap all your jewels for stable coins\n` +
                "/stj [jewel_amount] : Stake jewel amount in the bank\n" +
                `/stj ${JEWEL_STAKE_ALL_CMD} : Stake all your jewels in the bank\n` +
                "/qr : Display quests report \n" +
                "/hr : Display heroes report \n" +
                "/exit_bot : Will exit bot completely\n" +
                "/help: this.");
        });

        this.telegraph.command("sell_rewards_off", async (ctx) => {
            GLOBAL.autoSellMiningRewards = false;
            ctx.reply("Auto-sell mining rewards is now [OFF] ⛔");
        });

        this.telegraph.command("sell_rewards_on", async (ctx) => {
            GLOBAL.autoSellMiningRewards = true;
            ctx.reply("Auto-sell mining rewards is now [ON] ✅");

            if (GLOBAL.autoStakeMiningRewards === true) {
                GLOBAL.autoStakeMiningRewards = false;
                ctx.reply("Auto-stake was also set [OFF] ⛔");
            }
        });

        this.telegraph.command("stake_rewards_off", async (ctx) => {
            GLOBAL.autoStakeMiningRewards = false;
            ctx.reply("Auto-stake mining rewards is now [OFF] ⛔");
        });

        this.telegraph.command("stake_rewards_on", async (ctx) => {
            GLOBAL.autoStakeMiningRewards = true;
            ctx.reply("Auto-stake mining rewards is now [ON] ✅");

            if (GLOBAL.autoSellMiningRewards === true) {
                GLOBAL.autoSellMiningRewards = false;
                ctx.reply("Auto-sell was also set [OFF] ⛔");
            }
        });

        this.telegraph.catch((telegramError) => {
            DFKLogger.log.trace("Telegram error : ", telegramError);
        });

        process.once("SIGINT", () => this.telegraph.stop("SIGINT"));
        process.once("SIGTERM", () => this.telegraph.stop("SIGTERM"));

        await this.telegraph.launch();
    }

    public async sendMsg(text: string) {
        await this.telegraph.telegram.sendMessage(
            config.telegramChannelId,
            text,
        );
    }

    private async balance(ctx) {
        if (!GLOBAL.JEWEL_HANDLER) {
            ctx.reply("Can't get balance, no Jewel contract setup.");
            return ;
        }

        const balance = await GLOBAL.JEWEL_HANDLER.balanceOf(config.wallet.address);

        ctx.reply(`Your current Jewel balance is ${balance} 💎💎`);
    }

    private async claimRewards(ctx) {
        if (GLOBAL_ALREADY_CLAIMING === true) {
            ctx.reply("You already called /claim, wait a bit :)");
            return ;
        }
        if (!GLOBAL.GARDENS_HANDLER) {
            ctx.reply("Can't claim rewards, no gardening setup.");
            return ;
        }

        ctx.reply("Trying to claim rewards, this can take few seconds... ⌛");

        GLOBAL_ALREADY_CLAIMING = true;

        const receipt = await GLOBAL.GARDENS_HANDLER.claimRewards();

        GLOBAL_ALREADY_CLAIMING = false;

        if (receipt.status !== 1) {
            ctx.reply("Error 🥲 Can't claim rewards");
            return ;
        }
        ctx.reply("Reward claimed 🥂 !");
    }

    private async stakeJewels(ctx) {
        try {
            if (!GLOBAL.BANK_HANDLER) {
                ctx.reply("Cannot stake in bank 🏝");
                return ;
            }

            const args  = ctx.update.message.text.split(" ");

            if (!args || !args[1] || Number(args[1]) <= 0) {
                ctx.reply(`Wrong parameters 🥲\nUsage ->  /stj [jewel_amount / ${JEWEL_STAKE_ALL_CMD}]`);
                return ;
            }

            const walletBalance = Number(await GLOBAL.JEWEL_HANDLER.balanceOf(config.wallet.address));
            const jewelsToStake = args[1] === JEWEL_STAKE_ALL_CMD ? walletBalance : Number(args[1]);

            if (jewelsToStake > walletBalance) {
                ctx.reply(`Error 🥲 Your wallet has ${walletBalance} Jewel and you tried to stake ${jewelsToStake}`);
                return ;
            }

            ctx.reply(`Trying to stake ${jewelsToStake} Jewels into the back...`);

            const [sentence, tx] = await GLOBAL.BANK_HANDLER.stake(jewelsToStake);

            if (sentence) {
                ctx.reply(sentence + "\n" + tx);
            } else {
                ctx.reply("Could not stake your Jewels 🥲");
            }

        } catch (e) {
            ctx.reply("Error swapping jewels 🥲");
            console.error("Error when replying to bot ", e);
        }
    }

    private async swapJewels(ctx) {
        try {
            if (!GLOBAL.DEX_HANDLER) {
                ctx.reply("Nothing to show yet 🏝");
                return ;
            }

            const args  = ctx.update.message.text.split(" ");

            if (!args || !args[1] || Number(args[1]) <= 0) {
                ctx.reply(`Wrong parameters 🥲\nUsage ->  /sr [jewel_amount / ${JEWEL_SELL_ALL_CMD}]`);
                return ;
            }

            const walletBalance = Number(await GLOBAL.JEWEL_HANDLER.balanceOf(config.wallet.address));
            const jewelsToSell = args[1] === JEWEL_SELL_ALL_CMD ? walletBalance : Number(args[1]);

            if (jewelsToSell > walletBalance) {
                ctx.reply(`Error 🥲 Your wallet has ${walletBalance} Jewel and you tried to sell ${jewelsToSell}`);
                return ;
            }

            const preferences = GLOBAL.getSwapPreferences(config);
            if (preferences.info.activated === false) {
                ctx.reply("Selling rewards is deactivated in your config.");
                return ;
            }

            ctx.reply(`Trying to sell ${jewelsToSell} Jewels for ${preferences.preferredPool.name}...`);
            const [sentence, hashTx, soldForAmount] = await GLOBAL.DEX_HANDLER.swapJewels(jewelsToSell, preferences);

            if (sentence) {
                GLOBAL.SWAPS.push({jewelSold: jewelsToSell, soldForAmount: Number(soldForAmount), soldForName: preferences.preferredPool.name, type: SWAP_TYPE.MANUAL, date: moment() });
                ctx.reply(sentence + "\n" + hashTx);
            } else {
                ctx.reply("Could not sell your Jewels 🥲");
            }

        } catch (e) {
            ctx.reply("Error swapping jewels 🥲");
            console.error("Error when replying to bot ", e);
        }
    }

    private questsStatus(ctx) {
        try {
            if (!GLOBAL.QUESTS_STATUS) {
                ctx.reply("Nothing to show yet 🏝");
                return ;
            }

            const running = GLOBAL.QUESTS_STATUS.serverQuests.running;
            const titleRunning = `\n- ${running.length} quest(s) currently running : \n`;
            const runningSentence = running.map((q) => {
                return `\n${QUEST_TYPE_TO_NAME_MAP[QUEST_ADDR_TO_TYPE_MAP[String(q.quest).toUpperCase()]]} is running and will complete the ${mFormat(moment(Number(q.completeAtTime) * 1000))}`;
            }).join("\n");

            const justCompleted = GLOBAL.QUESTS_STATUS.completedQuests;
            const titleCompleted = `\n- ${justCompleted.length} quest(s) completed last run : \n`;
            const completedSentence = justCompleted.map((q) => {
                return `\n${QUEST_TYPE_TO_NAME_MAP[QUEST_ADDR_TO_TYPE_MAP[String(q.quest).toUpperCase()]]} quest was completed last run.`;
            }).join("\n");

            const launched = GLOBAL.QUESTS_STATUS.launchedQuests;
            const titleLaunched = `\n- ${launched.length} quest(s) launched last run : \n`;
            const launchedSentence = launched.map((q) => {
                return `\n${QUEST_TYPE_TO_NAME_MAP[QUEST_ADDR_TO_TYPE_MAP[q.quest.contractAddress.toUpperCase()]]} quest was launched last run.`;
            }).join("\n");

            const soonStartable = GLOBAL.QUESTS_STATUS.soonStartableQuests;
            const soonTitle = `\n- ${soonStartable.length} quest(s) ready to start soon : \n`;
            const soonSentence = soonStartable.map((q) => {
                return `\n${QUEST_TYPE_TO_NAME_MAP[QUEST_ADDR_TO_TYPE_MAP[q.quest.contractAddress.toUpperCase()]]} quest ` +
                    `will launch soon, waiting heroes [${uniq([...q.heroStaminaNotReady.map((qh) => qh.hero), ...q.heroQuesting.map((qh) => qh.hero)])}] to be ready.`;
            }).join("\n");

            const sentences = [];
            sentences.push(runningSentence && runningSentence.length > 0 ? {order : 1, content : titleRunning + runningSentence } : {order: 0, content : "- No quest running."});
            sentences.push(completedSentence && completedSentence.length > 0 ?  {order : 2, content : titleCompleted + completedSentence} :  {order: 0, content : "- No quest completed last run."});
            sentences.push(launchedSentence && launchedSentence.length > 0 ?  {order : 3, content : titleLaunched + launchedSentence} :  {order: 0, content : "- No quest launched last run."});
            sentences.push(soonTitle && soonSentence.length > 0 ?  {order : 4, content : soonTitle + soonSentence } :  {order: 0, content : "- No quest to launch soon."});

            const toPrint = sentences.sort((a, b) => a.order - b.order).map((q) => q.content).join("\n");
            ctx.reply("📝 Quests report 📝 \n\n" + toPrint);

        } catch (err) {
            ctx.reply("Error calculating quests status 🥲");
            DFKLogger.log.trace("Error when replying to bot ", err);
        }
    }

    private async heroesStatus(ctx) {
       try {
           if (!GLOBAL.QUEST_HANDLER) {
               ctx.reply("Nothing to show yet 🏝");
               return ;
           }

           ctx.reply("Fetching heroes data.. can take few seconds.. ⌛");

           const allMyHeroes = config.quests.flatMap((q) => q.heroTeam).flatMap((ht) => ht.heroes).slice(0, 30);

           const sentencesFormatted = (await Bluebird.map(allMyHeroes, async (hero, index) => {
               const heroInfo = await GLOBAL.QUEST_HANDLER.getHeroData(hero);
               const formatted = await GLOBAL.QUEST_HANDLER.getHeroFormattedData(heroInfo);

               if (formatted.isQuesting) {
                   return { order: 1, formatted, content : `\nHero [${hero}] is questing on ${QUEST_TYPE_TO_NAME_MAP[formatted.questType]} quest 🤑`};
               } else if (formatted.isHeroFullStamina) {
                   return { order: 2, formatted, content: `\nHero [${hero}] is full stamina (${formatted.stamina}) 😃`};
               } else {
                  return { order: 3, formatted, content: `\nHero [${hero}] has ${formatted.stamina} stamina and will be full the ${moment(formatted.fullAt).format("Do, h:mm:ss a")} 😴`};
           }})).sort((a, b) => a.order - b.order);

           const sentences = sentencesFormatted.map((s) => s.content).join("\n");
           const heroesCanLevelUp = sentencesFormatted.map((q) => {
               const maxXp = (q.formatted.level * 1000) + 1000;

               if (q.formatted.xp >= maxXp) {
                   return `\nHero [${q.formatted.hero}], currently level ${q.formatted.level} has ${q.formatted.xp}/${maxXp} exp and is ready to ✨✨ level up ✨✨`;
               }
               return undefined;
           }).filter((h) => h && h.length).join("\n");

           ctx.reply("📝 Heroes report 📝\n\n" + sentences + (heroesCanLevelUp && heroesCanLevelUp.length > 1 ? "\n✨ Ready to level up ✨ :\n" + heroesCanLevelUp : ""));
       } catch (err) {
           ctx.reply("Error calculating heroes status 🥲");
           console.error("Error when replying to bot ", err);
       }
    }

    private async bankBalance(ctx) {
        try {
            if (!GLOBAL.BANK_HANDLER) {
                ctx.reply("Nothing to show yet 🏝");
                return ;
            }

            const xJewel = await GLOBAL.BANK_HANDLER.balance();

            ctx.reply(`You currently have ${xJewel} xJewels / ${Number(xJewel) * 1.681} Jewel staked in the bank.`);

        } catch (err) {
            ctx.reply("Error calculating bankBalance 🥲");
            console.error("Error when replying to bot ", err);
        }
    }

    private rewardsDay(ctx) {
        try {
            if (!GLOBAL.REWARDS || GLOBAL.REWARDS.length <= 0) {
                ctx.reply("Nothing to show yet 🏝");
                return ;
            }

            const welcome = "Rewards 💰 for last 24 hours :\n";
            const last24Hours =  GLOBAL.REWARDS.filter((greward) => moment().diff(greward.date, "days") <= 1);
            const sentence = last24Hours.map((gReward) => {
                return `\nQuest ${gReward.questName} gave :\n ${gReward.rewards.map((r) => {
                    return r.rewardString;
                }).join("\n")}`;
            }).join("\n");

            const totalRewards = countTotalRewardsForDisplay(last24Hours);

            ctx.reply(welcome + sentence + `\n\nTotal :\n${totalRewards.join("\n")}`);
        } catch (err) {
            ctx.reply("Error calculating rewards 🥲");
            console.error("Error when replying to bot ", err);
        }
    }

    private profitReport(ctx) {
        try {
            if (!GLOBAL.SWAPS || GLOBAL.SWAPS.length <= 0) {
                ctx.reply("Nothing to show yet 🏝");
                return ;
            }

            const stableName = GLOBAL.SWAPS[0].soldForName;

            const last24hoursStable = GLOBAL.SWAPS.filter((preport) => moment().diff(preport.date, "days") <= 1)
              .reduce((acc, curr) => curr.soldForAmount + acc, 0);
            const last24hoursJewel = GLOBAL.SWAPS.filter((preport) => moment().diff(preport.date, "days") <= 1)
              .reduce((acc, curr) => curr.jewelSold + acc, 0);

            ctx.reply(`Sold a total of ${last24hoursJewel} Jewel for ${last24hoursStable} ${stableName} the last 24 hours 💰💰`);

            const lastSinceCalledStable = GLOBAL.SWAPS.filter((preport) => preport.date.diff(GLOBAL.profitTelegramCmdCalledDate) > 0)
              .reduce((acc, curr) => curr.soldForAmount + acc, 0);
            const lastSinceCalledJewel = GLOBAL.SWAPS.filter((preport) => preport.date.diff(GLOBAL.profitTelegramCmdCalledDate) > 0)
              .reduce((acc, curr) => curr.jewelSold + acc, 0);

            const howLongAgo = GLOBAL.profitTelegramCmdCalledDate.fromNow();
            ctx.reply(`Sold a total of ${lastSinceCalledJewel} Jewel for ${lastSinceCalledStable} ${stableName} since ${howLongAgo} 💰💰`);

            GLOBAL.profitTelegramCmdCalledDate = moment();
        } catch (err) {
            ctx.reply("Error calculating profit 🥲");
            console.error("Error when replying to bot ", err);
        }
    }

    private rewardsSince(ctx) {
        try {
            if (!GLOBAL.REWARDS || GLOBAL.REWARDS.length <= 0 || !GLOBAL.rsTelegramCmdCalledDate) {
                ctx.reply("Nothing to show yet 🏝");
                return ;
            }

            const howLongAgo = GLOBAL.rsTelegramCmdCalledDate.fromNow();
            const welcome = `Rewards 💰 since ${howLongAgo} :\n`;
            const rewardsSince =  GLOBAL.REWARDS.filter((greward) => greward.date.diff(GLOBAL.rsTelegramCmdCalledDate) > 0);

            if (!rewardsSince || rewardsSince.length <= 0) {
                ctx.reply(`No rewards since last /rs call which was ${howLongAgo} ago.`);
                return ;
            }

            const sentence = rewardsSince.map((gReward) => {
                return `\nQuest ${gReward.questName} gave :\n ${gReward.rewards.map((r) => {
                    return r.rewardString;
                }).join("\n")}`;
            }).join("\n");

            const totalRewards = countTotalRewardsForDisplay(rewardsSince);

            GLOBAL.rsTelegramCmdCalledDate = moment();
            ctx.reply(welcome + sentence + `\n\nTotal :\n${totalRewards.join("\n")}`);
        } catch (err) {
            ctx.reply("Error calculating rewards 🥲");
            console.error("Error when replying to bot ", err);
        }
    }

    private rewardsLastTen(ctx) {
        try {
            if (! GLOBAL.REWARDS ||  GLOBAL.REWARDS.length <= 0) {
                ctx.reply("Nothing to show yet 🏝");
                return ;
            }

            const welcome = "Rewards 💰 for last 10 quests :\n";
            const lastTen = _.takeRight( GLOBAL.REWARDS, 10);
            const sentence = lastTen.map((gReward) => {
                return `\nQuest ${gReward.questName} gave : \n ${gReward.rewards.map((r) => {
                    return r.rewardString;
                }).join("\n")}`;
            }).join("\n");

            const totalRewards = countTotalRewardsForDisplay(lastTen);

            ctx.reply(welcome + sentence + `\n\nTotal :\n ${totalRewards.join("\n")}`);
        } catch (err) {
            ctx.reply("Error calculating rewards 🥲");
            console.error("Error when replying to bot ", err);
        }
    }
}

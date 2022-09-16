import {Bank} from "./bank/bank";
import {Blockchain} from "./blockchain/blockchain";
import { Erc20 } from "./blockchain/erc20";
import {Bot} from "./bot/bot";
import config from "./config/config.json";
import { Dex } from "./dex/dex";
import {Gardens} from "./gardens/gardens";
import {DFKSuperLogger} from "./logger/logger";
import {TelegramBot} from "./logger/telegram";
import {QuestManager} from "./questManager/questManager";
import {Global} from "./utils/global";

export const GLOBAL = new Global();

/**
 * Create logger & telegram bot - always create SuperTelegram before SuperLogger
 */
export const DFKTelegram = new TelegramBot();
export const DFKLogger: DFKSuperLogger = new DFKSuperLogger();

const main = async () => {
  try {

    const DFKBlockchain = new Blockchain(config);
    await DFKBlockchain.connectToRpc();
    await DFKBlockchain.connectToWallet();

    GLOBAL.QUEST_HANDLER = new QuestManager(DFKBlockchain, config);
    GLOBAL.GARDENS_HANDLER = new Gardens(DFKBlockchain, config);
    GLOBAL.DEX_HANDLER = new Dex(DFKBlockchain, config);
    GLOBAL.JEWEL_HANDLER = new Erc20(DFKBlockchain, config.jewelSwap.jewel);
    GLOBAL.BANK_HANDLER = new Bank(DFKBlockchain, config);

    GLOBAL.autoSellMiningRewards = config.autoSellMiningRewards;
    GLOBAL.autoStakeMiningRewards = config.autoStakeMiningRewards;

    if (GLOBAL.autoStakeMiningRewards  && GLOBAL.autoSellMiningRewards) {
      DFKLogger.log.error("You cannot have autoStakeMiningRewards AND autoSellMiningRewards true at the same time, chose one.");
      return ;
    }

    const DFKBot = new Bot(GLOBAL.QUEST_HANDLER, DFKBlockchain, config);

    if (config.printGardenData) {
      DFKLogger.log.silly(`Bot will print garden data - this can take 1/2 minutes.`);
      await GLOBAL.GARDENS_HANDLER.printMyGardens();
    }

    await DFKTelegram.start();

    await DFKBot.run();

  } catch (err) {
    DFKLogger.log.error(`Unable to launch bot: ${err.message}`);
  }
};

main();

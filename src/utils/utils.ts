import _ from "lodash";
import moment from "moment/moment";
import * as readline from "readline";
import rewardLookup from "../constants/rewards.json";
import { IGlobalBotConfig, IGlobalReward, RewardType } from "../constants/types";

export const countTotalRewardsByType = (toCount: IGlobalReward[]) => _.toPairs(_.groupBy(toCount.flatMap((g) => g.rewards), (r) => r.rewardType))
  .map(([rewardType, rewards]) => {
    const total = rewards.reduce((acc, cur) => {
      return acc + cur.amount;
    }, 0);
    return {
      type: RewardType[rewardType],
      total,
    };
  });

export const countTotalRewardsForDisplay = (toCount: IGlobalReward[]) => countTotalRewardsByType(toCount).map((r) => {
  const eggEmoji = [RewardType.GREENPETEGG, RewardType.BLUEPETEGG, RewardType.GREYPETEGG, RewardType.YELLOWPETEGG]
    .includes(r.type) ? "🥚🥚 - !!" : "";

  return `${r.total} x ${r.type} ${eggEmoji}`;
});

export const delay = (ms: number) => {
  return new Promise( (resolve) => setTimeout(resolve, ms) );
};

export const getRpc = (cfg: IGlobalBotConfig, currentRpc: string, switchRpc: boolean = false) => {
  if (!switchRpc || !currentRpc || !cfg.fallbackRpcOnError) {
    return cfg.rpcs.poktRpc;
  }

  switch (currentRpc) {
    case cfg.rpcs.harmonyRpc:
      return cfg.rpcs.poktRpc;
    case cfg.rpcs.poktRpc:
      return cfg.rpcs.fuzzRpc;
    case cfg.rpcs.fuzzRpc:
      return cfg.rpcs.hermesRpc;
    case cfg.rpcs.hermesRpc:
      return cfg.rpcs.harmonyRpc;
    default:
      return cfg.rpcs.poktRpc;
  }
 };

export const staminaDiffToTime = (minStamToRun: number, heroStam: number): moment.Moment => moment().add((minStamToRun - heroStam) * 20, "minutes");

export const mFormat = (d: moment.Moment): string => d.format("MMMM Do YYYY, h:mm:ss a");

export const calculateRemainingStamina = (readyAt: moment.Moment, maxStam: number): number  => {
  const duration = moment.duration(readyAt.diff(moment()));
  return Math.floor(maxStam - duration.asMinutes() / 20);
};
/**
 * Generic function to prompt input to user
 * @param prompt
 * @param promptFor
 * @param hide
 */
export const promptForInput = async (prompt, promptFor, hide: boolean = false): Promise<string> => {
  const read = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "DFKQUEST> ",
  });

  try {
    const input: string = await new Promise((resolve) => {
      read.question(prompt, (answer) => resolve(answer));
    });
    if (!input) {
      throw new Error(
        `No ${promptFor} provided. Try running the application again, and provide a ${promptFor}.`,
      );
    }
    return input;
  } finally {
    read.close();
    if (hide) {
      console.clear();
    }
  }
};

/**
 * Convert milliseconds to readable string
 * @param ms
 */
export const msToTime = (ms): string => {
  const seconds = (ms / 1000).toFixed(1);
  const minutes = (ms / (1000 * 60)).toFixed(1);
  const hours = (ms / (1000 * 60 * 60)).toFixed(1);
  const days = (ms / (1000 * 60 * 60 * 24)).toFixed(1);
  if (Number(seconds) < 60) {
    return seconds + " Sec";
  } else if (Number(minutes) < 60) {
    return minutes + " Min";
  }

  if (Number(hours) < 24) {
    return hours + " Hrs";
  } else {
    return days + " Days";
  }
};

/**
 * Helper func to display time in readable manner
 * @param timestamp
 */
export const displayTime = (timestamp) => {
  const d = new Date(timestamp * 1000);
  const hour = d.getHours();
  const min = d.getMinutes();
  const sec = d.getSeconds();
  return hour + ":" + min + ":" + sec;
};

/**
 * Get reward readable name base on contract address
 * @param rewardAddress
 */
export const getRewardReadable = (rewardAddress) => {
  const desc = rewardLookup[rewardAddress];
  return desc ? desc : rewardAddress;
};

/**
 * Small utils to get date from quest timestamp
 * @param timestamp
 */
export const toDate = (timestamp: number) => moment(new Date(timestamp)).format("MMMM Do YYYY, h:mm:ss a");

import {Provider} from "@ethersproject/providers";
import {Contract, Wallet} from "ethers";
import moment from "moment";

export enum QuestType {
    FORAGING = "FORAGING",
    FISHING =  "FISHING",
    MINING_JEWEL = "MINING_JEWEL",
    MINING_GOLD = "MINING_GOLD",
    GARDENING = "GARDENING",
    NONE = "NONE",
}

export const SERVER_ERROR_CODES = ["SERVER_ERROR", "CALL_EXCEPTION", "NONCE_EXPIRED"];
export const RPC_ISSUES_REASONS = ["processing response error", "transaction failed", "nonce has already been used"];

export enum RewardType {
    JEWEL = "JEWEL",
    GOLD =  "GOLD",
    XP = "XP",
    SKILLUP = "SKILLUP",
    AMBERTAFFY = "AMBERTAFFY",
    DARKWEED = "DARKWEED",
    GOLDVEIN = "GOLDVEIN",
    RAGWEED = "RAGWEED",
    REDLEAF = "REDLEAF",
    ROCKROOT = "ROCKROOT",
    SWIFTTHISTLE =  "SWIFTTHISTLE",
    BLOATER = "BLOATER",
    IRONSCALE = "IRONSCALE",
    LANTERNEYE = "LANTERNEYE",
    REDGILL = "REDGILL",
    SAILFISH = "SAILFISH",
    SHIMMERSKIN = "SHIMMERSKIN",
    SILVERFIN = "SILVERFIN",
    SHVASRUNE = "SHVASRUNE",
    BLUESTEM = "BLUESTEM",
    BLUEPETEGG = "BLUEPETEGG",
    GREYPETEGG = "GREYPETEGG",
    GREENPETEGG = "GREENPETEGG",
    GAIASTEARS = "GAIASTEARS",
    YELLOWPETEGG = "YELLOWPETEGG",
    SPIDERFRUIT= "SPIDERFRUIT",
    MILKWEED = "MILKWEED",
}

export const REWARD_NAME_TO_TYPE_MAP: Record<string, RewardType> = {
    "Ambertaffy" : RewardType.AMBERTAFFY,
    "Darkweed" : RewardType.DARKWEED,
    "Milkweed": RewardType.MILKWEED,
    "Goldvein" : RewardType.GOLDVEIN,
    "Ragweed" : RewardType.RAGWEED,
    "Redleaf" : RewardType.REDLEAF,
    "Rockroot" : RewardType.ROCKROOT,
    "Swift-Thistle" : RewardType.SWIFTTHISTLE,
    "Bloater" : RewardType.BLOATER,
    "Ironscale" : RewardType.IRONSCALE,
    "Lanterneye" : RewardType.LANTERNEYE,
    "Redgill" : RewardType.REDGILL,
    "Spider Fruit" : RewardType.SPIDERFRUIT,
    "Sailfish" : RewardType.SAILFISH,
    "Shimmerskin" : RewardType.SHIMMERSKIN,
    "Silverfin" : RewardType.SILVERFIN,
    "Shvas Rune" : RewardType.SHVASRUNE,
    "Blue Stem" : RewardType.BLUESTEM,
    "Blue Pet Egg" : RewardType.BLUEPETEGG,
    "Grey Pet Egg" : RewardType.GREYPETEGG,
    "Green Pet Egg" : RewardType.GREENPETEGG,
    "Gaia's Tears" : RewardType.GAIASTEARS,
    "Yellow Pet Egg" : RewardType.YELLOWPETEGG,
    "Gold" : RewardType.GOLD,
    "Jewel" : RewardType.JEWEL,
};

export const QUEST_ADDR_TO_TYPE_MAP: Record<string, QuestType> = {
    "0XE259E8386D38467F0E7FFEDB69C3C9C935DFAEFC" : QuestType.FISHING,
    "0X3132C76ACF2217646FB8391918D28A16BD8A8EF4" : QuestType.FORAGING,
    "0X6FF019415EE105ACF2AC52483A33F5B43EADB8D0" : QuestType.MINING_JEWEL,
    "0X569E6A4C2E3AF31B337BE00657B4C040C828DD73" : QuestType.MINING_GOLD,
    "0XE4154B6E5D240507F9699C730A496790A722DF19" : QuestType.GARDENING,
    "0x0000000000000000000000000000000000000000" : QuestType.NONE,
};

export const QUEST_TYPE_TO_NAME_MAP: Record<QuestType, string> = {
    [QuestType.FISHING] : "Fishing",
    [QuestType.FORAGING] : "Foraging",
    [QuestType.MINING_JEWEL] : "Jewel mining",
    [QuestType.MINING_GOLD] : "Gold mining",
    [QuestType.GARDENING] : "Gardening",
    [QuestType.NONE] : "None",
};

export const QUEST_NAME_TO_TYPE_MAP: Record<string, QuestType> = {
    "Fishing": QuestType.FISHING,
    "Foraging": QuestType.FORAGING,
    "Jewel mining": QuestType.MINING_JEWEL,
    "Gold mining": QuestType.MINING_GOLD,
    "Gardening": QuestType.GARDENING,
    "None": QuestType.NONE,
};

export class ServerQuest { public running: any[] = []; public active: any[] = []; public completed: any[] = []; }

export type addressType = string;

export type additionalQuestDataType = [number, number, number, number, number, number, string, string, addressType, addressType, addressType, addressType];

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export enum SWAP_TYPE {
    AUTO = "AUTO",
    MANUAL = "MANUAL",
}

export interface ISwapReport {
    jewelSold: number;
    soldForAmount: number;
    soldForName: string;
    type: SWAP_TYPE;
    date: moment.Moment;
}

export interface IReward {
    amount: number;
    rewardType: RewardType;
    rewardString: string;
}

export interface IGlobalQuestStatus {
    serverQuests: ServerQuest;
    completedQuests: any[];
    launchedQuests: IStartableQuest[];
    soonStartableQuests: IStartableQuestSoon[];
}

export interface IGlobalReward  {
    questName: string;
    rewards: IReward[];
    date: moment.Moment;
}

export interface IStartableQuest {
    quest: IQuestConfig;
    team: IHeroTeam;
    type: QuestType;
    lowestStamina: number;
    heroesReady: number[];
}

export interface IStartableQuestSoon {
    quest: IQuestConfig;
    heroFullAt: number;
    heroReadyForQuestAt: number;
    heroQuesting: IHeroesWallet[];
    heroStaminaNotReady: IHeroesWallet[];
}

export interface IHeroesWallet {
    hero: number;
    stamina: number;
    isQuesting: boolean;
    isHeroFullStamina: boolean;
    questType: QuestType;
    fullAt: number;
    xp: number;
    level: number;
}

export interface ILaunchableQuest {
    address: string;
    attempts: number;
    heroes: number[];
    name: string;
    group: boolean;
    professional: boolean;
}

export interface IHeroTeam {
    name: string;
    heroes: number[];
    gardenId?: number;
    minTeamSize: number;
    minStaminaRequired: number;
}

export interface IWalletConfig {
    address: string;
    encryptedWalletPath: string;
    encryptedWalletPathPassword: string;
}

export interface IQuestConfig {
    name: string;
    activated: boolean;
    heroTeam: IHeroTeam[];
    contractAddress: string;
}

export interface IGasOption {
    gasPrice: number;
    gasLimit: number;
}

export interface ISwapPool {
    name: string;
    pool: string;
    token: string;
    decimals: number;
}

export interface IJewelSwap {
    activated: boolean;
    jewel: string;
    preferredSwap: string;
    swapPools: ISwapPool[];
}

export interface IGlobalBotConfig {
    wallet: IWalletConfig;
    gas: IGasOption;

    telegramBotToken: string;
    telegramChannelId: string;

    printGardenData: boolean;

    quests: IQuestConfig[];

    pollingIntervalInstantQuest: number;
    pollingIntervalError: number;
    pollingIntervalQuest: number;

    autoSellMiningRewards: boolean;
    jewelSwap: IJewelSwap;

    gardensContract: string;
    questContract: string;
    heroContract: string;
    dexContract: string;
    bankContract: string;

    fallbackRpcOnError: boolean;
    numberOfErrorBeforeFallBack: number;
    maximumSwitchBeforeAddingDelay: number;

    gardensToClaim: number[];
    rpcs: {
        harmonyRpc: string;
        poktRpc: string;
        fuzzRpc: string;
        hermesRpc: string;
    };

}

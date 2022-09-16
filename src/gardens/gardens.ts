import {DFKLogger} from "../app";
import {Blockchain} from "../blockchain/blockchain";
import {IGlobalBotConfig} from "../constants/types";

const GARDEN_LP_ADDR_TO_NAME_MAP: Record<string, string> = {
    "0xE01502Db14929b7733e7112E173C3bCF566F996E" : "JEWEL/BUSD",
    "0x093956649D43f23fe4E7144fb1C3Ad01586cCf1e" : "JEWEL/AVAX",
    "0x7f89b5F33138C89FAd4092a7C079973C95362D53" : "JEWEL/FTM",
    "0xB6e9754b90b338ccB2a74fA31de48ad89f65ec5e" : "JEWEL/LUNA",
};

export class Gardens {

    public gardenIds: number[];

    private blockchain: Blockchain;
    private cfg: IGlobalBotConfig;

    constructor(blockchain: Blockchain, cfg: IGlobalBotConfig) {
        this.blockchain = blockchain;
        this.cfg = cfg;
        this.gardenIds = [];
    }

    public async printMyGardens() {
        const poolLength = await this.blockchain.gardensContract.poolLength();

        for (let id = 0; id < poolLength; id++) {
            const poolInfo = await this.blockchain.gardensContract.poolInfo(id);
            const userInfo = await this.blockchain.gardensContract.userInfo(id, this.cfg.wallet.address);

            if (userInfo && userInfo.amount > 0) {
                this.gardenIds.push(id);
                DFKLogger.log.silly(`Found garden ${GARDEN_LP_ADDR_TO_NAME_MAP[poolInfo.lpToken]} with id ${id} - You have ${Number(userInfo.amount / 1000000000000000000)} LP in this pool.`);
            }
        }
        console.log("\n");
    }

    public async claimRewards() {
        try {
           const tx = await this.blockchain.gardensContract.connect(this.blockchain.wallet).claimRewards(this.cfg.gardensToClaim, this.cfg.gas);
           return await tx.wait();
        } catch (e) {
            DFKLogger.log.error(e);
            return undefined;
        }
    }
}

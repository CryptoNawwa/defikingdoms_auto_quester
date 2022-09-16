import {ethers} from "ethers";
import {DFKLogger} from "../app";
import {Blockchain} from "../blockchain/blockchain";
import {IGlobalBotConfig} from "../constants/types";

export class Bank {

    private blockchain: Blockchain;
    private cfg: IGlobalBotConfig;

    constructor(blockchain: Blockchain, cfg: IGlobalBotConfig) {
        this.blockchain = blockchain;
        this.cfg = cfg;
    }

    public async balance() {
        const balance = await this.blockchain.bankContract.balanceOf(this.cfg.wallet.address);
        return Number(ethers.utils.formatEther(balance)).toFixed(3);
    }

    public async stake(jewelAmount) {
        try {
            const jewelAmountInBN = ethers.utils.parseEther(jewelAmount.toString());

            const receipt  = await this.blockchain.tryTransaction(() => this.blockchain.bankContract.connect(this.blockchain.wallet)
                .enter(jewelAmountInBN, this.cfg.gas), 2);

            const sentence = `Successfully staked ${jewelAmount} Jewel in the bank 💰💰 !`;
            DFKLogger.log.info(sentence);
            return [sentence, `Transaction hash : https://explorer.harmony.one/tx/${receipt.transactionHash}`];
        } catch (e) {
            DFKLogger.log.error("Cannot stake jewel", e);
            return undefined;
        }
    }
}

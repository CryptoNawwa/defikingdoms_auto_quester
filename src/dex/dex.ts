import { BigNumber, Contract, ethers} from "ethers";
import moment from "moment/moment";
import { DFKLogger } from "../app";
import { Blockchain } from "../blockchain/blockchain";
import poolAbi from "../constants/abis/pool_abi.json";
import { IGlobalBotConfig, IJewelSwap, ISwapPool } from "../constants/types";

export const DECIMALS_POW_10 = (dec) => Number(Math.pow(10, dec));

export class Dex {

  private blockchain: Blockchain;
  private cfg: IGlobalBotConfig;

  constructor(blockchain: Blockchain, cfg: IGlobalBotConfig) {
    this.blockchain = blockchain;
    this.cfg = cfg;
  }

  public async swapJewels(jewelAmount, swapPreference: {info: IJewelSwap, preferredPool: ISwapPool } ) {
    try {

      const currentPoolContract = new ethers.Contract(
        swapPreference.preferredPool.pool,
        poolAbi,
        this.blockchain.provider,
      );

      const jewelAmountInBN = ethers.utils.parseEther(jewelAmount.toString());
      const [res0, res1] = await currentPoolContract.getReserves();

      const quote = await this.blockchain.dexContract.quote(jewelAmountInBN, res0, res1);
      const quoteReadable = Number(quote) / DECIMALS_POW_10(swapPreference.preferredPool.decimals);
      const safeQuote = Math.floor(quote  - (quote * (0.5 / 100)));

      const receipt = await this.blockchain.tryTransaction(() => this.blockchain.dexContract.connect(this.blockchain.wallet)
        .swapExactTokensForTokens(
          jewelAmountInBN,
          safeQuote,
          [swapPreference.info.jewel, swapPreference.preferredPool.token],
          this.cfg.wallet.address,
          moment().add(2, "minutes").unix(),
          this.cfg.gas), 2);

      const sentence = `Swapped ${jewelAmount} Jewel for approx. ${quoteReadable} ${swapPreference.preferredPool.name} 💰💰 !`;
      DFKLogger.log.info(sentence);
      return [sentence, `Transaction hash : https://explorer.harmony.one/tx/${receipt.transactionHash}`, quoteReadable];
    } catch (e) {
      DFKLogger.log.error("Can't sell jewels : ", e);
      return undefined;
    }
  }

}

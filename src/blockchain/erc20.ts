import { Contract, ethers } from "ethers";
import abiErc20 from "../constants/abis/abi_erc_20.json";
import { Blockchain } from "./blockchain";

export class Erc20 {

  public contract: Contract;

  constructor(blockchain: Blockchain, tokenAddr: string) {

    this.contract = new ethers.Contract(
      tokenAddr,
      abiErc20,
      blockchain.provider,
    );
  }

  public async balanceOf(walletAddress: string) {
   const balance =  await this.contract.balanceOf(walletAddress);
   return Number(ethers.utils.formatEther(balance)).toFixed(3);
  }
}

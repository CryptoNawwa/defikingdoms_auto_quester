import {Provider} from "@ethersproject/providers";
import {Contract, ContractInterface, ethers, Wallet} from "ethers";
import {existsSync, readFileSync, writeFileSync} from "fs";
import {DFKLogger, GLOBAL} from "../app";
import abiBank from "../constants/abis/abi_bank.json";
import abiGardens from "../constants/abis/abi_master_gardener.json";
import abiQuest from "../constants/abis/abi_quest_v2.json";
import abiDex from "../constants/abis/abi_uniswap_v2_router.json";

import { IGlobalBotConfig } from "../constants/types";
import {TransactionError} from "../error/transactionError";
import {getRpc, promptForInput} from "../utils/utils";
import {decrypt, encrypt} from "./encryption";

export class Blockchain {

    public questContractAddr: string;
    public questAbi: ContractInterface;
    public questContract: Contract;

    public gardensContractAddr: string;
    public gardensAbi: ContractInterface;
    public gardensContract: Contract;

    public dexContractAddr: string;
    public dexAbi: ContractInterface;
    public dexContract: Contract;

    public bankContractAddr: string;
    public bankAbi: ContractInterface;
    public bankContract: Contract;

    public provider: Provider;
    public wallet: Wallet;
    public currentRpc: string;

    private readonly walletPath: string;
    private readonly passwordPath: string;

    private readonly cfg: IGlobalBotConfig;

     constructor(cfg: IGlobalBotConfig) {
         this.cfg = cfg;

         this.questContractAddr = cfg.questContract;
         this.questAbi = abiQuest;

         this.gardensContractAddr = cfg.gardensContract;
         this.gardensAbi = abiGardens;

         this.dexContractAddr = cfg.dexContract;
         this.dexAbi = abiDex;

         this.bankContractAddr = cfg.bankContract;
         this.bankAbi = abiBank;

         this.walletPath = cfg.wallet.encryptedWalletPath;
         this.passwordPath = cfg.wallet.encryptedWalletPathPassword;
    }

    public async fallback() {
        DFKLogger.log.silly(`Fallback needed - Trying to switch RPC to ${getRpc(this.cfg, this.currentRpc, true)}...`);
        GLOBAL.SWITCH_COUNTER++;

        try {
             await this.connectToRpc(true);
             await this.connectToWallet(true);

             GLOBAL.RPC_ERRORS = [];
             DFKLogger.log.info(`RPC Switched successfully, now on ${this.currentRpc}`);
         } catch (e) {
             DFKLogger.log.info(`Could not switch RPCs`);
             DFKLogger.log.trace(e);
        }
    }

    public async connectToRpc(switchRpc: boolean = false) {

         this.currentRpc = getRpc(this.cfg, this.currentRpc, switchRpc);

         this.provider = new ethers.providers.JsonRpcProvider(this.currentRpc);

         this.questContract = new ethers.Contract(
            this.questContractAddr,
            this.questAbi,
            this.provider,
        );

         this.gardensContract = new ethers.Contract(
            this.gardensContractAddr,
            this.gardensAbi,
            this.provider,
        );

         this.dexContract = new ethers.Contract(
          this.dexContractAddr,
          this.dexAbi,
          this.provider,
        );

         this.bankContract = new ethers.Contract(
            this.bankContractAddr,
            this.bankAbi,
            this.provider,
        );
     }

     public async connectToWallet(useStoredPass: boolean = false) {
         this.wallet = useStoredPass ? this.encryptAndConnectWallet(this.getStoredPws()) :
             existsSync(this.walletPath)
                 ? await this.getEncryptedWallet()
                 : await this.createWallet();
     }

    /**
     * Try as many attempts transaction on the current blockchain
     * @param transaction
     * @param attempts
     */
    public async tryTransaction(transaction, attempts) {
        for (let i = 0; i < attempts; i++) {
            try {
                const tx = await transaction();
                const receipt = await tx.wait();
                if (receipt.status !== 1) {
                    throw new TransactionError(`Error - Receipt had a status of ${receipt.status}`);
                }
                return receipt;
            } catch (err) {
                if (i === attempts - 1) {
                   throw err;
                }
            }
        }
    }

    public storePassword(pwd) {
        return writeFileSync(this.passwordPath, encrypt(String(pwd)));
    }

    public getStoredPws() {
        return String(decrypt(readFileSync(this.passwordPath, "utf8")));
    }

    /**
     * Get current encrypted wallet using previously used password
     */
    public async getEncryptedWallet(): Promise<Wallet> {
        console.log("\nHi. You need to enter the password you chose previously.");
        const pw = await promptForInput("Enter your password: ", "password", true);
        try {
            this.storePassword(pw);
            return this.encryptAndConnectWallet(pw);
        } catch (err) {
            throw new Error("Unable to read your encrypted wallet. " +
                "Try again, making sure you provide the correct password. " +
                'If you have forgotten your password, delete the file "w.json" and run the application again.');
        }
    }

    /**
     * Import wallet using pvks (called if no wallet found)
     */
    public async createWallet(): Promise<Wallet> {
        console.log("\nHi. You have not yet encrypted your private key.");
        const pw = await promptForInput("Choose a password for encrypting " +
            "your private key, and enter it here: ", "password");
        const pk = await promptForInput("Now enter your private key: ", "private key");
        this.storePassword(pw);
        try {
            const newWallet = new ethers.Wallet(pk, this.provider);
            const enc = await newWallet.encrypt(pw);
            writeFileSync(this.cfg.wallet.encryptedWalletPath, enc);
            return newWallet;
        } catch (err) {
            throw new Error("Unable to create your wallet. Try again, making sure you provide a valid private key.");
        }
    }

    private encryptAndConnectWallet(password: string) {
        const encryptedWallet = readFileSync(this.walletPath, "utf8");
        const decryptedWallet = ethers.Wallet.fromEncryptedJsonSync(encryptedWallet, password);
        return decryptedWallet.connect(this.provider);
    }

}

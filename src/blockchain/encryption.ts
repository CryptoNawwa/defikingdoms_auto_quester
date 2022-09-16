import CryptoJS from "crypto-js";
import config from "../config/config.json";

const KEY = config.telegramBotToken.slice(0, 5);

export const encrypt = (data: string) => {
    return CryptoJS.AES.encrypt(data, KEY).toString();
};

export const decrypt = (data: string) => {
    return CryptoJS.AES.decrypt(data, KEY).toString(CryptoJS.enc.Utf8);
};

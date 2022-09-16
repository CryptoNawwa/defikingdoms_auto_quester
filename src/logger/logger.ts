import {appendFileSync} from "fs";
import moment from "moment";
import {ILogObject, Logger} from "tslog";
import {DFKTelegram} from "../app";

// Global variable to make it work inside transporters
let logPath;

export class DFKSuperLogger {

    public log: Logger;

    constructor() {

        logPath = `${moment().format("ddd-MM-Do-h:mm")}.txt`;

        this.log = new Logger({
            type: "pretty",
            displayInstanceName: false,
            displayFunctionName: false,
            displayFilePath: "hidden",
            displayLoggerName: false,
            displayRequestId: false,
            printLogMessageInNewLine: true,
        });

        this.log.attachTransport(
            {
                silly: this.logToFile,
                debug: this.logToFile,
                trace: this.logToFile,
                info: this.logToFile,
                warn: this.logToFile,
                error: this.logToFile,
                fatal: this.logToFile,
            },
            "debug",
        );

        this.log.attachTransport(
            {
                silly: this.nothing,
                debug: this.nothing,
                trace: this.nothing,
                info: this.logToTelegram,
                warn: this.nothing,
                error: this.nothing,
                fatal: this.nothing,
            },
            "debug",
        );
    }

    private nothing(logObject: ILogObject) {
        return ;
    }

     private async logToTelegram(logObject: ILogObject) {
        try {
            if (!DFKTelegram) {
                throw new Error("SuperTelegram not defined.");
            }
            await DFKTelegram.sendMsg(logObject.argumentsArray[0].toString());
        } catch (e) {
            console.error("Error - Telegram SPAM ", e);
            throw e;
        }
    }

    private logToFile(logObject: ILogObject)  {
        try {
            appendFileSync(logPath, JSON.stringify(logObject) + "\n");
        } catch (e) {
            console.error("ERROR LOG WRITE");
        }
    }
}

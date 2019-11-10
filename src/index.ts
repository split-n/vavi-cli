import * as vavi from "vavi";
import util from "util";
import readline from 'readline';
import * as child_process from 'child_process'
import fs from "fs";
import * as csvWriter from 'csv-writer';

const readFile = util.promisify(fs.readFile);


class LoginCardInfo extends vavi.LoginCardInfo {
    title?: string;
}

async function* getAsyncReadlineIter(): AsyncIterableIterator<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
    });

    for await (const line of rl) {
        yield line;
    }
}

async function main() {
    const cardInfoPath = process.argv[2];
    const outCsvPath = process.argv[3];

    const json = await readFile(cardInfoPath, 'utf8');
    const loginCardInfos: LoginCardInfo[] = JSON.parse(json);
    const crawler = await vavi.launch({});


    const result = [];

    for (const loginCardInfo of loginCardInfos) {
        // don't use map to await sequentially
        const stats = await crawl(crawler, loginCardInfo);
        result.push({title: loginCardInfo.title, balance: stats.balance, isNetUseEnabled: stats.isNetUseEnabled});
    }

    const cw = csvWriter.createObjectCsvWriter({
        path: outCsvPath,
        header: [
            {id: 'title', title: 'Title'},
            {id: 'balance', title: 'Balance'},
            {id: 'isNetUseEnabled', title: 'IsNetUseEnabled'}]
    });
    await cw.writeRecords(result);
}

async function crawl(crawler: vavi.VaViCrawler, loginCardInfo: vavi.LoginCardInfo): Promise<vavi.CardUsageStats> {
    let captcha = await crawler.getCardUsageStats(loginCardInfo);
    const readlineIter = getAsyncReadlineIter();
    while (true) {
        child_process.spawn('google-chrome', [captcha.captchaImage], {detached: true});
        process.stdout.write("Please input captcha.\n> ");

        const inputData = await readlineIter.next();
        if (inputData.done) {
            throw new Error("Cancelled");
        }

        const result = await captcha.continueFunc(inputData.value);
        console.log(util.inspect(result));
        if (result instanceof vavi.CaptchaInterruption) {
            captcha = result;
        } else {
            return result;
        }
    }
}

main();

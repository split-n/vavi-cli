import * as vavi from "vavi";
import util from "util";
import readline from 'readline';
import * as child_process from 'child_process'
import fs from "fs";

const readFile = util.promisify(fs.readFile);


class LoginCardInfo extends vavi.LoginCardInfo {
    title?: string;
}

async function* getAsyncReadlineIter() : AsyncIterableIterator<string> {
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
    const json = await readFile(process.argv[2], 'utf8');
    const loginCardInfos: LoginCardInfo[] = JSON.parse(json);
    const crawler = await vavi.launch({});


    const result: vavi.CardUsageStats[] = [];

    for(const loginCardInfo of loginCardInfos) {
        // don't use map to await sequentially
        result.push(await crawl(crawler, loginCardInfo));
    }
}

async function crawl(crawler: vavi.VaViCrawler, loginCardInfo: vavi.LoginCardInfo) :Promise<vavi.CardUsageStats>{
    let captcha = await crawler.getCardUsageStats(loginCardInfo);
    const readlineIter = getAsyncReadlineIter();
    while(true) {
        child_process.spawn('google-chrome', [captcha.captchaImage], {detached: true});
        process.stdout.write("Please input captcha.\n> ");

        const inputData = await readlineIter.next();
        if(inputData.done) {
            throw new Error("Cancelled");
        }

        const result = await captcha.continueFunc(inputData.value);
        console.log(util.inspect(result));
        if(result instanceof vavi.CaptchaInterruption) {
            captcha = result;
        } else {
            return result;
        }
    }
}

main();

import fs from "fs";
import readline from "readline";
import { isWebsiteOnline, logger, makeValidUrl } from "../utils/utils";
import { contactScrapping } from "../scrapping/contact.scrapping";
import { contactDataModel } from "../models/contact.model";
import path from "path";

export const contactSchedule = async () => {
    try {
        logger("Contatct Schedule Starting...");
        const fileStream = fs.createReadStream(path.resolve(__dirname, "..", "..", "assets", "sample-websites-company-names.csv"));
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity,
        });
        for await (const line of rl) {
            const lineComponents = line.split(",");
            if (lineComponents[0].split(".").length > 1) {
                const validUrl = makeValidUrl(lineComponents[0]);
                const isValid = await isWebsiteOnline(validUrl);
                if (isValid) {
                    const contactDataRetrieved = await contactDataModel.findOne({
                        url: validUrl,
                    })
                    const dataScrapped = await contactScrapping(validUrl);
                    dataScrapped.company_commercial_name = lineComponents[1];
                    dataScrapped.company_legal_name = lineComponents[2];
                    dataScrapped.company_all_available_names = lineComponents[3].split("|");
                    if (contactDataRetrieved) {
                        Object.assign(contactDataRetrieved, dataScrapped);
                        await contactDataRetrieved.save();
                    } else {
                        await contactDataModel.create(dataScrapped);
                    }
                    logger(dataScrapped);
                }
            }
        }
        logger("Contatct Schedule Stopped!");
    } catch (err) {
        logger(err, true);
    }
}
import { error, log } from "console";
import { addressRegex, phoneRegex } from "./regex";
import https from "https";

export const logger = (item: unknown, isError?: boolean) => {
    if (process.env.APP_MODE !== "production") {
        if (isError) {
            error(item);
            return;
        }
        log(item);
    }
};

export const makeValidUrl = (inputUrl: string) => {
    try {
        return new URL(inputUrl).href;
    } catch (error) {
        logger(error, true);
        return new URL(`https://${inputUrl}`).href;
    }
}

export const extractAddressFromText = (text: string): string | null => {
    const lines = text.split(/\n|\r/).map(l => l.trim()).filter(Boolean);

    for (const line of lines) {
        const match = line.match(addressRegex);
        if (match) return match[0].trim();
    }

    return null;
};

export function extractPhoneNumbers(text: string): string[] {
    if (!text) return [];

    const matches = text.match(phoneRegex);
    if (!matches) return [];

    const filtered = matches
        .map(m => m.replace(/[^\d+]/g, ""))
        .filter(m => {
            const digits = m.replace(/\D/g, "");
            return digits.length >= 10 && digits.length <= 11;
        });

    return Array.from(new Set(filtered));
}

export const isWebsiteOnline = async (url: string): Promise<boolean> => {
    return new Promise((resolve) => {
        const req = https.request(url, { method: "HEAD" }, (res) => {
            if (res.statusCode === 200) {
                resolve(true);
            } else {
                resolve(false);
            }
        });

        req.on("timeout", () => {
            req.destroy();
            resolve(false);
        });

        req.on("error", (error) => {
            logger(error, true);
            resolve(false);
        });

        req.end();
    });
}
import * as puppeteer from "puppeteer-core";
import chromium from "chromium";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { addressRegex, phoneRegex } from "../utils/regex";
import { extractAddressFromText, extractPhoneNumbers, logger, makeValidUrl } from "../utils/utils";
import { ContactData } from "../types/contact.type";

export const contactScrapping = async (url: string): Promise<ContactData> => {
    const result: ContactData = {
        url,
        phones: [],
        socials: {},
        address: null,
        success: false,
    };

    let browser: puppeteer.Browser | null = null;

    try {
        browser = await puppeteer.launch({
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-blink-features=AutomationControlled",
            ],
            executablePath: chromium.path,
        });

        const page = await browser.newPage();
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForSelector("body");
        await new Promise(r => setTimeout(r, 3000));

        try {
            await page.evaluate((text) => {
                const buttons = Array.from(document.querySelectorAll("button, a"));
                const closeButton = buttons.find(button => button.innerHTML.includes(text) || button.textContent.includes(text));
                return closeButton ? closeButton : null;
            }, "Close", "button");
        } catch (error) {
            logger(error, true);
        }

        const extractContactInfo = async (
            page: puppeteer.Page
        ): Promise<Partial<ContactData>> => {
            let locationData = null;
            try {
                locationData = await page.evaluate(() => {
                    let address = null;
                    let coords = null;

                    const iframes = Array.from(document.querySelectorAll("iframe[src*='google.com/maps']"));
                    for (const iframe of iframes) {
                        const src = (iframe as HTMLIFrameElement).src;

                        const coordMatch = src.match(/[@!](-?\d+\.?\d*),(-?\d+\.?\d*)/);
                        if (coordMatch) {
                            coords = {
                                lat: parseFloat(coordMatch[1]),
                                lng: parseFloat(coordMatch[2])
                            };
                        }

                        const qMatch = src.match(/[?&]q=([^&]+)/);
                        if (qMatch) {
                            address = decodeURIComponent(qMatch[1]);
                        }

                        if (coords || address) break;
                    }

                    if (!address && !coords) {
                        const mapLinks = Array.from(document.querySelectorAll("a[href*=\"google.com/maps\"]"));
                        for (const link of mapLinks) {
                            const href = (link as HTMLAnchorElement).href;

                            const coordMatch = href.match(/[@!](-?\d+\.?\d*),(-?\d+\.?\d*)/);
                            if (coordMatch) {
                                coords = {
                                    lat: parseFloat(coordMatch[1]),
                                    lng: parseFloat(coordMatch[2])
                                };
                            }

                            const qMatch = href.match(/[?&]q=([^&]+)/);
                            if (qMatch) {
                                address = decodeURIComponent(qMatch[1]);
                            }

                            if (coords || address) break;
                        }
                    }

                    if (!coords) {
                        const scripts = Array.from(document.querySelectorAll("script[type=\"application/ld+json\"]"));
                        for (const script of scripts) {
                            try {
                                const data = JSON.parse(script.textContent || "");

                                const findGeo = (obj) => {
                                    if (obj?.geo?.latitude && obj?.geo?.longitude) {
                                        return {
                                            lat: parseFloat(obj.geo.latitude),
                                            lng: parseFloat(obj.geo.longitude)
                                        };
                                    }
                                    if (obj?.latitude && obj?.longitude) {
                                        return {
                                            lat: parseFloat(obj.latitude),
                                            lng: parseFloat(obj.longitude)
                                        };
                                    }
                                    if (typeof obj === "object" && obj !== null) {
                                        for (const val of Object.values(obj)) {
                                            const found = findGeo(val);
                                            if (found) return found;
                                        }
                                    }
                                    return null;
                                };

                                const findAddress = (obj): string | null => {
                                    if (obj?.["@type"]?.includes("PostalAddress")) {
                                        const parts = [
                                            obj.streetAddress,
                                            obj.addressLocality,
                                            obj.addressRegion,
                                            obj.postalCode,
                                            obj.addressCountry,
                                        ].filter(Boolean);
                                        if (parts.length > 0) return parts.join(", ");
                                    }
                                    if (obj?.address && typeof obj.address === "string") {
                                        return obj.address;
                                    }
                                    if (typeof obj === "object" && obj !== null) {
                                        for (const val of Object.values(obj)) {
                                            const found = findAddress(val);
                                            if (found) return found;
                                        }
                                    }
                                    return null;
                                };

                                coords = coords || findGeo(data);
                                address = address || findAddress(data);

                                if (coords && address) break;
                            } catch (error) {
                                logger(error, true);
                            }
                        }
                    }

                    if (!coords) {
                        const geoMeta = {
                            lat: document.querySelector("meta[name=\"geo.position\"]")?.getAttribute("content")?.split(";")[0],
                            lng: document.querySelector("meta[name=\"geo.position\"]")?.getAttribute("content")?.split(";")[1],
                        };
                        if (geoMeta.lat && geoMeta.lng) {
                            coords = {
                                lat: parseFloat(geoMeta.lat),
                                lng: parseFloat(geoMeta.lng)
                            };
                        }
                    }

                    if (!coords) {
                        const osmIframes = Array.from(document.querySelectorAll("iframe[src*='openstreetmap.org']"));
                        for (const iframe of osmIframes) {
                            const src = (iframe as HTMLIFrameElement).src;
                            const coordMatch = src.match(/[?&]mlat=(-?\d+\.?\d*).*[?&]mlon=(-?\d+\.?\d*)/);
                            if (coordMatch) {
                                coords = {
                                    lat: parseFloat(coordMatch[1]),
                                    lng: parseFloat(coordMatch[2])
                                };
                                break;
                            }
                        }
                    }

                    if (!address) {
                        const addressTags = Array.from(document.querySelectorAll("address"));
                        for (const tag of addressTags) {
                            const text = tag.innerText?.trim();
                            if (text && text.length > 15 && text.length < 300) {
                                address = text;
                                break;
                            }
                        }
                    }

                    if (!address) {
                        const selectors = [
                            "[class*=\"address\" i]",
                            "[class*=\"location\" i]",
                            "[id*=\"address\" i]",
                            "[id*=\"location\" i]",
                            "[data-location]",
                            "[itemprop=\"address\"]",
                        ];

                        for (const selector of selectors) {
                            const elements = Array.from(document.querySelectorAll(selector));
                            for (const el of elements) {
                                const text = (el as HTMLElement).innerText?.trim();
                                if (text && text.length > 15 && text.length < 300) {
                                    if (addressRegex.test(text)) {
                                        address = extractAddressFromText(text);
                                        break;
                                    }
                                }
                            }
                            if (address) break;
                        }
                    }

                    if (!address) {
                        const footer = document.querySelector("footer");
                        if (footer) {
                            const footerText = footer.innerText || "";
                            const lines = footerText.split("\n").map((l) => l.trim());
                            for (let i = 0; i < lines.length - 1; i++) {
                                const combined = lines.slice(i, Math.min(i + 3, lines.length)).join(" ");
                                if (addressRegex.test(combined)) {
                                    address = combined;
                                    break;
                                }
                            }
                        }
                    }

                    return { address, coords };
                });
            } catch (error) {
                logger(error, true);
            }

            const visibleText = await page.evaluate(() => document.body.innerText || "");
            const text = visibleText.replace(/\s+/g, " ").trim();

            const rawPhones = text.match(phoneRegex) || [];
            const validPhones = new Set<string>();

            for (const raw of rawPhones) {
                try {
                    const parsed = parsePhoneNumberFromString(raw);
                    if (parsed && parsed.isValid()) validPhones.add(parsed.format("E.164"));
                } catch (err) {
                    logger(err, true);
                }
            }

            const telLinks = await page.$$eval("a[href^=\"tel:\"]", (as) =>
                as.map((a) => (a as HTMLAnchorElement).href.replace("tel:", "").trim())
            );

            for (const tel of telLinks) {
                try {
                    const parsed = parsePhoneNumberFromString(tel);
                    if (parsed && parsed.isValid()) validPhones.add(parsed.format("E.164"));
                } catch (err) {
                    logger(err, true);
                }
            }

            const finalAddress = locationData?.address || extractAddressFromText(text);

            const links = await page.$$eval("a[href]", (as) =>
                as.map((a) => (a as HTMLAnchorElement).href)
            );

            const socials: ContactData["socials"] = {};
            for (const link of links) {
                const l = link.toLowerCase();
                if (l.includes("facebook.com") && !socials.facebook) socials.facebook = link;
                if (l.includes("instagram.com") && !socials.instagram) socials.instagram = link;
                if (l.includes("linkedin.com") && !socials.linkedin) socials.linkedin = link;
                if ((l.includes("twitter.com") || l.includes("x.com")) && !socials.twitter)
                    socials.twitter = link;
                if (l.includes("tiktok.com") && !socials.tiktok) socials.tiktok = link;
            }

            return {
                phones: Array.from(
                    new Set([...validPhones, ...extractPhoneNumbers(finalAddress), ...extractPhoneNumbers(text)])
                ),
                socials,
                address: finalAddress,
                coords: locationData?.coords ?? null,
            };
        };

        const mainData = await extractContactInfo(page);
        Object.assign(result, mainData);

        const links = await page.$$eval("a[href]", (as) =>
            as.map((a) => ({
                href: (a as HTMLAnchorElement).href,
                text: (a as HTMLAnchorElement).innerText?.toLowerCase() || "",
            }))
        );

        const hostname = new URL(url).hostname;
        const possibleContactLinks = links
            .filter(
                (link) =>
                    (link.href.toLowerCase().includes("contact") ||
                        link.text.toLowerCase().includes("find us") ||
                        link.href.toLowerCase().includes("location") ||
                        link.text.toLowerCase().includes("where") ||
                        link.text.toLowerCase().includes("directions") ||
                        link.href.toLowerCase().includes("about") ||
                        link.href.toLowerCase().includes("terms") ||
                        link.href.toLowerCase().includes("legal") ||
                        link.href.toLowerCase().includes("imprint") ||
                        link.href.toLowerCase().includes("impressum")) &&
                    (link.href.startsWith("http") ? link.href.includes(hostname) : true)
            )
            .map((l) => l.href)
            .slice(0, 7);

        for (const contactLink of possibleContactLinks) {
            try {
                const contactLinkValid = makeValidUrl(contactLink);

                logger(`Trying location page: ${contactLinkValid}`);
                await page.goto(makeValidUrl(contactLinkValid), { waitUntil: "domcontentloaded", timeout: 15000 });
                await page.waitForSelector("body");
                await new Promise(r => setTimeout(r, 3000));

                try {
                    await page.evaluate((text) => {
                        const buttons = Array.from(document.querySelectorAll("button, a"));
                        const closeButton = buttons.find(button => button.innerHTML.includes(text) || button.textContent.includes(text));
                        return closeButton ? closeButton : null;
                    }, "Close", "button");
                } catch (error) {
                    logger(error, true);
                }

                const contactData = await extractContactInfo(page);

                if (contactData.phones && contactData.phones.length > 0) {
                    result.phones = Array.from(
                        new Set([...result.phones, ...contactData.phones])
                    );
                }
                result.socials = { ...result.socials, ...contactData.socials };

                if (contactData.address && !result.address) {
                    result.address = contactData.address;
                }
                if (contactData.coords && !result.coords) {
                    result.coords = contactData.coords;
                }

                if (result.address && result.coords) {
                    break;
                }
            } catch (err) {
                logger(`Failed location page ${contactLink}: ${err}`);
            }
        }

        result.success = true;
    } catch (err) {
        result.error = err.message || "scraping failed";
    } finally {
        if (browser) await browser.close();
    }

    return result;
};
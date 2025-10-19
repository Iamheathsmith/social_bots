import { AtpAgent } from "@atproto/api";
import sharp from "sharp";
import { detectFacets, UnicodeString } from "./helpers.js";
import { API_KEYS } from "./config/api_keys.js";
// --- 1. Init clients ---
const agent = new AtpAgent({ service: "https://bsky.social" });
const HANDLE = API_KEYS.BLUESKY_HANDLE;
const APP_PASSWORD = API_KEYS.BLUESKY_APP_PASSWORD;
export async function postToBlueSky(text, imageBuffer) {
    await agent.login({ identifier: HANDLE, password: APP_PASSWORD });
    const metadata = await sharp(imageBuffer).metadata();
    const uploadedImg = await agent.uploadBlob(imageBuffer, { encoding: "image/jpeg" });
    await agent.post({
        text: text,
        facets: detectFacets(new UnicodeString(text)),
        embed: {
            $type: "app.bsky.embed.images",
            images: [
                {
                    image: uploadedImg.data.blob,
                    alt: text,
                    aspectRatio: {
                        width: metadata.width ?? 2000,
                        height: metadata.height ?? 2000,
                    },
                },
            ],
        },
    });
}

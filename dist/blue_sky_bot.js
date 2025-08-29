import fs from "fs";
import path from "path";
import sharp from "sharp";
import { AtpAgent } from "@atproto/api";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// 🔑 Load creds from environment variables
const HANDLE = process.env.BLUESKY_HANDLE;
const APP_PASSWORD = process.env.BLUESKY_APP_PASSWORD;
const GEMINI_API_KEY = process.env.GOOGLE_API_KEY;
// --- 1. Init clients ---
const agent = new AtpAgent({ service: "https://bsky.social" });
// --- 2. Load JSON captions ---
const captionsPath = path.join(__dirname, "captions.json");
const captions = JSON.parse(fs.readFileSync(captionsPath, "utf8"));
// --- 3. Helper for default caption ---
const DEFAULT_CAPTION = "Enjoy this amazing image! #MorningMagic";
// Initialize the Gemini client
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
// Encode a local image file to a Base64 string
function fileToGenerativePart(path, mimeType) {
    return {
        inlineData: {
            data: fs.readFileSync(path).toString("base64"),
            mimeType,
        },
    };
}
async function generateTweetCaption(imagePath) {
    // For the 'generateContent' method, use a model that supports images, such as 'gemini-1.5-flash'.
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
    Analyze this image and write a compelling and engaging tweet about it.
    The post should include relevant hashtags and be less than 220 characters.
    The tweet should be appropriate for a general audience and include 2 hashtags.
	content and hashtags should be geared towards travel and photography.
	ONLY return the caption and hashtags. Do NOT include any introductory text.
  `;
    const image = fileToGenerativePart(imagePath, "image/jpeg");
    const result = await model.generateContent([prompt, image]);
    if (result) {
        return result.response.text();
    }
    else {
        return DEFAULT_CAPTION;
    }
}
async function runBot() {
    // --- 4. Login ---
    await agent.login({ identifier: HANDLE, password: APP_PASSWORD });
    // --- 5. Find unused images ---
    const unusedImages = Object.keys(captions).filter((img) => !captions[img]?.used);
    if (unusedImages.length === 0) {
        console.log("No unused images left.");
        return;
    }
    const randomFile = unusedImages[Math.floor(Math.random() * unusedImages.length)];
    const imagePath = path.join(__dirname, "images", randomFile);
    // --- 6. Process image ---
    let quality = 100;
    let processedBuffer;
    while (true) {
        const image = sharp(imagePath);
        const metadata = await image.metadata();
        let resizeOptions = {};
        if (metadata.width && metadata.height) {
            if (metadata.width > 2000 || metadata.height > 2000) {
                resizeOptions = metadata.width >= metadata.height ? { width: 2000 } : { height: 2000 };
            }
        }
        processedBuffer = await image.resize(resizeOptions).rotate().withMetadata().jpeg({ quality }).toBuffer();
        if (processedBuffer.byteLength <= 976560 || quality <= 40)
            break;
        quality -= 5;
    }
    const finalMetadata = await sharp(processedBuffer).metadata();
    // --- 7. Generate caption & hashtags ---
    const finalText = await generateTweetCaption(imagePath);
    // --- 8. Upload image to Bluesky ---
    const uploadedImg = await agent.uploadBlob(processedBuffer, { encoding: "image/jpeg" });
    // --- 9. Post with image and facets ---
    await agent.post({
        text: finalText,
        facets: detectFacets(new UnicodeString(finalText)),
        embed: {
            $type: "app.bsky.embed.images",
            images: [
                {
                    image: uploadedImg.data.blob,
                    alt: finalText,
                    aspectRatio: {
                        width: finalMetadata.width ?? 2000,
                        height: finalMetadata.height ?? 2000,
                    },
                },
            ],
        },
    });
    // --- 10. Mark image as used ---
    captions[randomFile].used = true;
    captions[randomFile].text = finalText;
    fs.writeFileSync("captions.json", JSON.stringify(captions, null, 2));
    console.log(`Posted ${randomFile} with hashtags and updated captions.json.`);
}
runBot().catch(console.error);
const encoder = new TextEncoder();
const decoder = new TextDecoder();
class UnicodeString {
    constructor(utf16) {
        this.utf16 = utf16;
        this.utf8 = encoder.encode(utf16);
    }
    utf16IndexToUtf8Index(i) {
        return encoder.encode(this.utf16.slice(0, i)).byteLength;
    }
}
export function detectFacets(text) {
    const facets = [];
    let match;
    // Mentions
    const reMention = /(^|\s|\()(@)([a-zA-Z0-9.-]+)(\b)/g;
    while ((match = reMention.exec(text.utf16))) {
        const start = text.utf16.indexOf(match[3], match.index) - 1;
        facets.push({
            $type: "app.bsky.richtext.facet",
            index: {
                byteStart: text.utf16IndexToUtf8Index(start),
                byteEnd: text.utf16IndexToUtf8Index(start + match[3].length + 1),
            },
            features: [{ $type: "app.bsky.richtext.facet#mention", did: match[3] }],
        });
    }
    // Hashtags
    const reTag = /(?:^|\s)(#[^\d\s]\S*)(?=\s)?/g;
    while ((match = reTag.exec(text.utf16))) {
        let tag = match[0].trim().replace(/\p{P}+$/gu, "");
        if (tag.length > 66)
            continue;
        const index = match.index + (/^\s/.test(match[0]) ? 1 : 0);
        facets.push({
            index: { byteStart: text.utf16IndexToUtf8Index(index), byteEnd: text.utf16IndexToUtf8Index(index + tag.length) },
            features: [{ $type: "app.bsky.richtext.facet#tag", tag: tag.replace(/^#/, "") }],
        });
    }
    return facets.length > 0 ? facets : undefined;
}

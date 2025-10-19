import fs from "fs";
import path from "path";
import sharp from "sharp";
import { AtpAgent } from "@atproto/api";
import { fileURLToPath } from "url";
import { detectFacets, UnicodeString } from "./helpers.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_CAPTION = "Enjoy this amazing image! #MorningMagic";
// 🔑 Load creds from environment variables
const HANDLE = process.env.BLUESKY_HANDLE;
const APP_PASSWORD = process.env.BLUESKY_APP_PASSWORD;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// --- 1. Init clients ---
const agent = new AtpAgent({ service: "https://bsky.social" });
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
		Analyze this image and write a tweet that is compelling, natural, and engaging. 
		The tweet must be less than 290 characters (including spaces), but 
		appropriate for a general audience, and include exactly 3 relevant hashtags focused on travel and photography (but not #TravelPhotography or overly generic tags). 
		Avoid emojis and icons. 
		About half the time, phrase the caption as a question to encourage engagement. 
		Use descriptive and emotional language that evokes curiosity or wonder about the scene, and make it specific to this image. 
		Return only the tweet text with hashtags, with no extra commentary.
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
    console.log("Logging in...", HANDLE, APP_PASSWORD);
    await agent.login({ identifier: HANDLE, password: APP_PASSWORD });
    // --- 5. Find images in images/ folder ---
    const imagesDir = path.join(process.cwd(), "src/images");
    const postedDir = path.join(process.cwd(), "src/posted");
    if (!fs.existsSync(postedDir)) {
        fs.mkdirSync(postedDir);
    }
    const files = fs.readdirSync(imagesDir).filter((f) => !f.startsWith("."));
    if (files.length === 0) {
        console.log("No images found in images/");
        return;
    }
    const randomFile = files[Math.floor(Math.random() * files.length)];
    const imagePath = path.join(imagesDir, randomFile);
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
    // --- 10. Move image to posted/ ---
    function moveImageToPosted(filename) {
        const oldPath = path.join(imagesDir, filename);
        const newPath = path.join(postedDir, filename);
        fs.renameSync(oldPath, newPath);
        console.log(`Moved ${filename} → posted`);
    }
    moveImageToPosted(randomFile);
}
runBot().catch(console.error);

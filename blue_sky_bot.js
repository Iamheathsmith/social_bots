"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const api_1 = require("@atproto/api");
// 🔑 Load creds from environment variables
// const HANDLE = process.env.BLUESKY_HANDLE as string;
// const APP_PASSWORD = process.env.BLUESKY_APP_PASSWORD as string;
const HANDLE = "kr0nk.bsky.social";
const APP_PASSWORD = "HoduDahee123";
// --- 1. Init Bluesky client ---
const agent = new api_1.BskyAgent({ service: "https://bsky.social" });
async function runBot() {
    // --- 2. Login ---
    await agent.login({ identifier: HANDLE, password: APP_PASSWORD });
    // --- 3. Load JSON captions ---
    const captions = JSON.parse(fs_1.default.readFileSync("captions.json", "utf8"));
    // --- 4. Pick a random image from /images ---
    const imagesDir = path_1.default.join(__dirname, "images");
    const postedDir = path_1.default.join(__dirname, "posted");
    // ensure "posted" folder exists
    if (!fs_1.default.existsSync(postedDir)) {
        fs_1.default.mkdirSync(postedDir);
    }
    const files = fs_1.default.readdirSync(imagesDir).filter((f) => !f.startsWith("."));
    if (files.length === 0)
        throw new Error("No images found in images/");
    const randomFile = files[Math.floor(Math.random() * files.length)];
    const imagePath = path_1.default.join(imagesDir, randomFile);
    // --- 5. Get caption from JSON ---
    const caption = captions[randomFile] || "No caption provided";
    // --- 6. Read image ---
    const imgBuffer = fs_1.default.readFileSync(imagePath);
    // --- 7. Upload image to Bluesky ---
    const uploadedImg = await agent.uploadBlob(imgBuffer, {
        encoding: "image/jpeg", // adjust if PNG, etc.
    });
    // --- 8. Post with caption + hashtag ---
    await agent.post({
        text: `${caption} #MyBot`,
        embed: {
            $type: "app.bsky.embed.images",
            images: [
                {
                    image: uploadedImg.data.blob,
                    alt: caption,
                },
            ],
        },
    });
    console.log(`✅ Posted ${randomFile} with caption.`);
    // --- 9. Move posted file to /posted ---
    const newPath = path_1.default.join(postedDir, randomFile);
    fs_1.default.renameSync(imagePath, newPath);
    console.log(`📂 Moved ${randomFile} → posted/`);
}
runBot().catch(console.error);
//# sourceMappingURL=blue_sky_bot.js.map
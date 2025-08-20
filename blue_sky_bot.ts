import fs from "fs";
import path from "path";
import sharp from "sharp";
import { AtpAgent } from "@atproto/api";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🔑 Load creds from environment variables
const HANDLE = process.env.BLUESKY_HANDLE as string;
const APP_PASSWORD = process.env.BLUESKY_APP_PASSWORD as string;

// --- 1. Init Bluesky client ---
const agent = new AtpAgent({ service: "https://bsky.social" });

async function runBot() {
	// --- 2. Login ---
	await agent.login({ identifier: HANDLE, password: APP_PASSWORD });

	// --- 3. Load JSON captions ---
	const captions = JSON.parse(fs.readFileSync("captions.json", "utf8"));

	// --- 4. Find unused images ---
	const unusedImages = Object.keys(captions).filter((img) => !captions[img].used);
	console.log("unusedImages: ", unusedImages);

	if (unusedImages.length === 0) {
		console.log("No unused images left.");
		return;
	}

	// Pick a random unused image
	const randomFile = unusedImages[Math.floor(Math.random() * unusedImages.length)];
	const imagePath = path.join(__dirname, "images", randomFile);

	// --- 5. Load image and resize to max 2000px ---
	let quality = 100;
	let processedBuffer: Buffer;

	while (true) {
		const image = sharp(imagePath);
		const metadata = await image.metadata();

		let resizeOptions = {};
		if (metadata.width && metadata.height) {
			if (metadata.width > 2000 || metadata.height > 2000) {
				if (metadata.width >= metadata.height) resizeOptions = { width: 2000 };
				else resizeOptions = { height: 2000 };
			}
		}

		processedBuffer = await image.resize(resizeOptions).rotate().withMetadata().jpeg({ quality }).toBuffer();

		if (processedBuffer.byteLength <= 976_560 || quality <= 40) break;
		quality -= 5; // step down quality until under 976 KB
	}

	const finalMetadata = await sharp(processedBuffer).metadata();

	// --- 6. Get text + hashtag from JSON ---
	// const captionData = captions[randomFile] || {};
	// const captionText = captionData?.text || "Good morning! Hope you have a wonderful day!";
	// const captionHashtag = captionData?.hashtag || "MorningMagic";
	const captionData = captions[randomFile] || {};
	let captionText = captionData?.text;

	if (typeof captionText !== "string" || !captionText.trim()) {
		captionText = "Image"; // fallback if empty or invalid
	}

	const captionHashtag =
		typeof captionData?.hashtag === "string" && captionData.hashtag.trim() ? captionData.hashtag : "MorningMagic";

	// --- 7. Upload image to Bluesky using processed buffer ---
	const uploadedImg = await agent.uploadBlob(processedBuffer, {
		encoding: "image/jpeg", // works for both jpeg and png if converted
	});

	// --- 8. Post with caption + hashtag and aspectRatio ---
	await agent.post({
		text: `${captionText} #${captionHashtag}`,
		embed: {
			$type: "app.bsky.embed.images",
			images: [
				{
					image: uploadedImg.data.blob,
					alt: String(captionText || ""),
					aspectRatio: {
						width: finalMetadata.width ?? 2000,
						height: finalMetadata.height ?? 2000,
					},
				},
			],
		},
	});

	// --- 9. Mark as used in captions.json ---
	captions[randomFile].used = true;
	fs.writeFileSync("captions.json", JSON.stringify(captions, null, 2));
	console.log(`Posted ${randomFile} and updated captions.json.`);
}

runBot().catch(console.error);

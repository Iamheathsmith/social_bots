import fs from "fs";
import path from "path";
import sharp from "sharp";
import { AtpAgent, UnicodeString } from "@atproto/api";
import { fileURLToPath } from "url";
import { detectFacets } from "./helpers";

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
	console.log("unusedImages:", unusedImages);

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
				resizeOptions = metadata.width >= metadata.height ? { width: 2000 } : { height: 2000 };
			}
		}

		processedBuffer = await image.resize(resizeOptions).rotate().withMetadata().jpeg({ quality }).toBuffer();

		if (processedBuffer.byteLength <= 976_560 || quality <= 40) break;
		quality -= 5;
	}

	const finalMetadata = await sharp(processedBuffer).metadata();

	// --- 6. Get caption text + hashtag(s) ---
	const captionData = captions[randomFile] || {};
	let captionText = captionData?.text?.trim() || "Good morning! Hope you have a wonderful day!";
	const hashtag = captionData?.hashtag?.trim() || "MorningMagic";
	const finalText = `${captionText} #${hashtag}`;

	// --- 7. Upload image to Bluesky ---
	const uploadedImg = await agent.uploadBlob(processedBuffer, { encoding: "image/jpeg" });

	// --- 8. Post with image and facets ---
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

	// --- 10. Mark as used ---
	captions[randomFile].used = true;
	fs.writeFileSync("captions.json", JSON.stringify(captions, null, 2));
	console.log(`Posted ${randomFile} with hashtags and updated captions.json.`);
}

runBot().catch(console.error);

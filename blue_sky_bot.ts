import fs from "fs";
import path from "path";
import sharp from "sharp";
import { AtpAgent } from "@atproto/api";

import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🔑 Load creds from environment variables
// const HANDLE = process.env.BLUESKY_HANDLE as string;
// const APP_PASSWORD = process.env.BLUESKY_APP_PASSWORD as string;
const HANDLE = "kr0nk.bsky.social";
const APP_PASSWORD = "HoduDahee123";

// --- 1. Init Bluesky client ---
const agent = new AtpAgent({ service: "https://bsky.social" });

async function runBot() {
	// --- 2. Login ---
	await agent.login({ identifier: HANDLE, password: APP_PASSWORD });

	// --- 3. Load JSON captions ---
	const captions = JSON.parse(fs.readFileSync("captions.json", "utf8"));

	// --- 4. Pick a random image from /images ---
	const imagesDir = path.join(__dirname, "images");
	const postedDir = path.join(__dirname, "posted");

	if (!fs.existsSync(postedDir)) {
		fs.mkdirSync(postedDir);
	}

	const files = fs.readdirSync(imagesDir).filter((f) => !f.startsWith("."));
	if (files.length === 0) throw new Error("No images found in images/");

	const randomFile = files[Math.floor(Math.random() * files.length)];
	const imagePath = path.join(imagesDir, randomFile);

	// --- 5. Load image and resize to max 2000px on long side ---
	const image = sharp(imagePath);
	const metadata = await image.metadata();

	let resizeOptions = {};
	if (metadata.width && metadata.height) {
		if (metadata.width >= metadata.height && metadata.width > 2000) {
			resizeOptions = { width: 2000 };
		} else if (metadata.height > metadata.width && metadata.height > 2000) {
			resizeOptions = { height: 2000 };
		}
	}

	const processedBuffer = await image
		.resize(resizeOptions) // resize long side ≤ 2000px
		.rotate() // auto-rotate based on EXIF
		.jpeg({ quality: 80 }) // compress to reduce size
		.toBuffer();

	const finalMetadata = await sharp(processedBuffer).metadata();

	// Optional safety check
	if (processedBuffer.byteLength > 976_560) {
		throw new Error(`Processed image is still too large: ${(processedBuffer.byteLength / 1024).toFixed(2)} KB`);
	}

	// --- 6. Get caption from JSON ---
	const caption = captions[randomFile] || "No caption provided";

	// --- 7. Upload image to Bluesky using processed buffer ---
	const uploadedImg = await agent.uploadBlob(processedBuffer, {
		encoding: "image/jpeg", // works for both jpeg and png if converted
	});

	// --- 8. Post with caption + hashtag and aspectRatio ---
	await agent.post({
		text: `${caption} #MyBot`,
		embed: {
			$type: "app.bsky.embed.images",
			images: [
				{
					image: uploadedImg.data.blob,
					alt: caption,
					aspectRatio: {
						width: finalMetadata.width ?? 2000,
						height: finalMetadata.height ?? 2000,
					},
				},
			],
		},
	});

	console.log(`✅ Posted ${randomFile} with caption.`);

	// --- 9. Move posted file to /posted ---
	const newPath = path.join(postedDir, randomFile);
	fs.renameSync(imagePath, newPath);

	console.log(`📂 Moved ${randomFile} → posted/`);
}

runBot().catch(console.error);

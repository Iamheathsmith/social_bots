import path from "path";
import fs from "fs";
import { postThread } from "./threads_bot.js";
import sharp from "sharp";
import { generateTweetCaption } from "./generate_text_caption.js";
import { postToBlueSky } from "./bluesky_bot.js";

import dotenv from "dotenv";

async function main() {
	if (!process.env.CI) {
		dotenv.config();
	}
	// --- 1. Find images in images/folder ---
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

	// --- 2. Process image ---
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

	const captionAndHashTags = await generateTweetCaption(imagePath);

	await postToBlueSky(captionAndHashTags, processedBuffer);
	await postThread(imagePath, captionAndHashTags);

	// --- 3. Move image to posted/ folder ---
	function moveImageToPosted(filename: string) {
		const oldPath = path.join(imagesDir, filename);
		const newPath = path.join(postedDir, filename);

		fs.renameSync(oldPath, newPath);
		console.log(`Moved ${filename} → posted`);
	}

	moveImageToPosted(randomFile);
}

main().catch(console.error);

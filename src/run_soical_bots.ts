import path from "path";
import fs from "fs";

import { postThread } from "./threads_bot.js";
import sharp from "sharp";
import { DEFAULT_CAPTION, generateTweetCaption } from "./generate_text_caption.js";
import { postToBlueSky } from "./bluesky_bot.js";

async function main() {
	// --- 1. Find images in images/folder ---
	const imagesDir = "/home/heath73/Code/Images/images_to_post";
	const postedDir = "/home/heath73/Code/Images/posted_images";
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

	let captionAndHashTags;
	try {
		captionAndHashTags = await generateTweetCaption(imagePath);
	} catch (error) {
		console.error("Error generating caption, using default caption:", error);
		captionAndHashTags = DEFAULT_CAPTION;
	}
	console.log("captionAndHashTags: ", captionAndHashTags);

	await postToBlueSky(captionAndHashTags, processedBuffer);
	await postThread(processedBuffer, captionAndHashTags);

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

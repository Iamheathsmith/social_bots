import fs from "fs";
import path from "path";
import sharp from "sharp";
import { AppBskyRichtextFacet, AtpAgent } from "@atproto/api";
import { fileURLToPath } from "url";
import TLDs from "tlds" assert { type: "json" };

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

type Facet = AppBskyRichtextFacet.Main;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

class UnicodeString {
	utf16: string;
	utf8: Uint8Array;

	constructor(utf16: string) {
		this.utf16 = utf16;
		this.utf8 = encoder.encode(utf16);
	}

	// helper to convert utf16 code-unit offsets to utf8 code-unit offsets
	utf16IndexToUtf8Index(i: number) {
		return encoder.encode(this.utf16.slice(0, i)).byteLength;
	}
}

export function detectFacets(text: UnicodeString): Facet[] | undefined {
	console.log("text: ", text);
	let match;
	const facets: Facet[] = [];
	{
		// mentions
		const re = /(^|\s|\()(@)([a-zA-Z0-9.-]+)(\b)/g;
		while ((match = re.exec(text.utf16))) {
			if (!isValidDomain(match[3]) && !match[3].endsWith(".test")) {
				continue; // probably not a handle
			}

			const start = text.utf16.indexOf(match[3], match.index) - 1;
			facets.push({
				$type: "app.bsky.richtext.facet",
				index: {
					byteStart: text.utf16IndexToUtf8Index(start),
					byteEnd: text.utf16IndexToUtf8Index(start + match[3].length + 1),
				},
				features: [
					{
						$type: "app.bsky.richtext.facet#mention",
						did: match[3], // must be resolved afterwards
					},
				],
			});
		}
	}
	{
		// links
		const re = /(^|\s|\()((https?:\/\/[\S]+)|((?<domain>[a-z][a-z0-9]*(\.[a-z0-9]+)+)[\S]*))/gim;
		while ((match = re.exec(text.utf16))) {
			let uri = match[2];
			if (!uri.startsWith("http")) {
				const domain = match.groups?.domain;
				if (!domain || !isValidDomain(domain)) {
					continue;
				}
				uri = `https://${uri}`;
			}
			const start = text.utf16.indexOf(match[2], match.index);
			const index = { start, end: start + match[2].length };
			// strip ending puncuation
			if (/[.,;!?]$/.test(uri)) {
				uri = uri.slice(0, -1);
				index.end--;
			}
			if (/[)]$/.test(uri) && !uri.includes("(")) {
				uri = uri.slice(0, -1);
				index.end--;
			}
			facets.push({
				index: {
					byteStart: text.utf16IndexToUtf8Index(index.start),
					byteEnd: text.utf16IndexToUtf8Index(index.end),
				},
				features: [
					{
						$type: "app.bsky.richtext.facet#link",
						uri,
					},
				],
			});
		}
	}
	{
		const re = /(?:^|\s)(#[^\d\s]\S*)(?=\s)?/g;
		while ((match = re.exec(text.utf16))) {
			let [tag] = match;
			const hasLeadingSpace = /^\s/.test(tag);

			tag = tag.trim().replace(/\p{P}+$/gu, ""); // strip ending punctuation

			// inclusive of #, max of 64 chars
			if (tag.length > 66) continue;

			const index = match.index + (hasLeadingSpace ? 1 : 0);

			facets.push({
				index: {
					byteStart: text.utf16IndexToUtf8Index(index),
					byteEnd: text.utf16IndexToUtf8Index(index + tag.length), // inclusive of last char
				},
				features: [
					{
						$type: "app.bsky.richtext.facet#tag",
						tag: tag.replace(/^#/, ""),
					},
				],
			});
		}
	}
	console.log("facets: ", facets);
	return facets.length > 0 ? facets : undefined;
}

function isValidDomain(str: string): boolean {
	return !!TLDs.find((tld) => {
		const i = str.lastIndexOf(tld);
		if (i === -1) {
			return false;
		}
		return str.charAt(i - 1) === "." && i === str.length - tld.length;
	});
}

import { AtpAgent } from "@atproto/api";
import sharp from "sharp";
import { detectFacets, UnicodeString } from "./helpers.js";

// --- 1. Init clients ---
const agent = new AtpAgent({ service: "https://bsky.social" });

const HANDLE = process.env.BLUESKY_HANDLE as string;
const APP_PASSWORD = process.env.BLUESKY_APP_PASSWORD as string;

export async function postToBlueSky(text: string, imageBuffer: Buffer) {
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

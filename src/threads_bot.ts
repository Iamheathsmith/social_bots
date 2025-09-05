import fs from "fs";
import path from "path";
import axios from "axios";
import FormData from "form-data";
import dotenv from "dotenv";

dotenv.config();

const THREADS_API_URL = "https://graph.facebook.com/v18.0/me/media"; // Replace with actual Threads endpoint
const ACCESS_TOKEN = process.env.THREADS_ACCESS_TOKEN as string;

/**
 * Post an image with text to Threads
 * @param imagePath Path to the local image
 * @param text Caption + hashtags to post
 */
export async function postThread(imagePath: string, text: string) {
	if (!fs.existsSync(imagePath)) {
		console.error("Image not found:", imagePath);
		return;
	}

	const form = new FormData();
	form.append("caption", text);
	form.append("file", fs.createReadStream(imagePath));

	try {
		const res = await axios.post(THREADS_API_URL, form, {
			headers: {
				...form.getHeaders(),
				Authorization: `Bearer ${ACCESS_TOKEN}`,
			},
		});
		console.log("Posted successfully:", res.data);
	} catch (err: any) {
		console.error("Error posting image:", err.response?.data || err.message);
	}
}

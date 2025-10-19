import axios from "axios";
import { v2 as cloudinary } from "cloudinary";
import { API_KEYS } from "./config/api_keys.js";

const THREADS_ACCESS_TOKEN = API_KEYS.THREADS_ACCESS_TOKEN;
const THREADS_USER_ID = API_KEYS.THREADS_USER_ID;

cloudinary.config({
	cloud_name: API_KEYS.CLOUDINARY_CLOUD_NAME,
	api_key: API_KEYS.CLOUDINARY_API_KEY,
	api_secret: API_KEYS.CLOUDINARY_API_SECRET,
});

/**
 * Posts a local image to Threads via Cloudinary and the Threads API.
 */
export async function postThread(imageBuffer: Buffer, text: string) {
	try {
		// Step 1: Upload to Cloudinary
		console.log("Uploading image buffer to Cloudinary...");
		const result = await new Promise<any>((resolve, reject) => {
			const stream = cloudinary.uploader.upload_stream({ folder: "threads_uploads" }, (error, result) =>
				error ? reject(error) : resolve(result)
			);
			stream.end(imageBuffer);
		});
		const imageUrl = result.secure_url;
		console.log("Image buffer uploaded to Cloudinary:", imageUrl);

		console.log("Waiting 30 seconds before Creating...");
		await new Promise((resolve) => setTimeout(resolve, 30000));
		// Step 2: Create media container
		console.log("Creating Threads media container...");
		const createRes = await axios.post(
			`https://graph.threads.net/v1.0/${THREADS_USER_ID}/threads`,
			{
				media_type: "IMAGE",
				image_url: imageUrl,
				text: text || " ",
			},
			{
				headers: {
					Authorization: `Bearer ${THREADS_ACCESS_TOKEN}`,
					"Content-Type": "application/json",
				},
			}
		);

		const creationId = createRes.data.id;
		if (!creationId) throw new Error("No creation ID returned from Threads API");

		console.log(`Media container created with ID: ${creationId}`);
		console.log("Waiting 30 seconds before publishing...");
		await new Promise((resolve) => setTimeout(resolve, 30000));

		// Step 3: Publish media container
		const publishRes = await axios.post(
			`https://graph.threads.net/v1.0/${THREADS_USER_ID}/threads_publish`,
			{ creation_id: creationId },
			{
				headers: {
					Authorization: `Bearer ${THREADS_ACCESS_TOKEN}`,
					"Content-Type": "application/json",
				},
			}
		);

		console.log("Posted successfully:", publishRes.data);
	} catch (err: any) {
		console.error("Error posting image:", err.response?.data || err.message);
	}
}

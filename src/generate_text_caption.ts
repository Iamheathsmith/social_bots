import fs from "fs";
import { API_KEYS } from "./config/api_keys.js";
import { GoogleGenAI, createUserContent, createPartFromUri } from "@google/genai";

const GEMINI_API_KEY = API_KEYS.GEMINI_API_KEY;
export const DEFAULT_CAPTION = "Enjoy this amazing image! #MorningMagic";

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

export async function generateTweetCaption(imagePath: string): Promise<string> {
	try {
		// Upload image first
		const uploadedImage = await ai.files.upload({ file: imagePath });

		const prompt = `
			Analyze this image and write a tweet that is compelling, natural, and engaging. and not overly halmark cliché.
			The tweet should aim for a length between 200 and 280 characters total (including hashtags). 
			If necessary to stay within this range, reduce the hashtags to only 2 instead of 3. 
			If the location in the image can be identified or reasonably inferred, the first hashtag must be the location name (e.g., #Paris, #Tuscany, #LakeComo). 
			The remaining one or two hashtags should relate to travel, photography, or the general atmosphere of that location (for example, #France #FrenchHoliday or #TravelPhotography #ExploreItaly). 
			Avoid emojis.
			Return only the tweet text with hashtags.
		`;
		if (!uploadedImage || !uploadedImage.uri || !uploadedImage.mimeType) {
			throw new Error("Image upload failed");
		}

		// Generate content using the uploaded image
		const response = await ai.models.generateContent({
			model: "gemini-2.0-flash",
			contents: [createUserContent([prompt, createPartFromUri(uploadedImage.uri, uploadedImage.mimeType)])],
		});

		return response.text || DEFAULT_CAPTION;
	} catch (error) {
		console.error("Error generating caption:", error);
		return DEFAULT_CAPTION;
	}
}

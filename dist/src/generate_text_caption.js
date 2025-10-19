import { API_KEYS } from "./config/api_keys.js";
import { GoogleGenAI, createUserContent, createPartFromUri } from "@google/genai";
const GEMINI_API_KEY = API_KEYS.GEMINI_API_KEY;
export const DEFAULT_CAPTION = "Enjoy this amazing image! #MorningMagic";
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
export async function generateTweetCaption(imagePath) {
    try {
        // Upload image first
        const uploadedImage = await ai.files.upload({ file: imagePath });
        const prompt = `
			Analyze this image and write a tweet that is compelling, natural, and engaging. 
			The tweet must be less than 290 characters, include 3 relevant hashtags focused on travel and photography, 
			avoid emojis, and about half the time phrase it as a question. 
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
    }
    catch (error) {
        console.error("Error generating caption:", error);
        return DEFAULT_CAPTION;
    }
}

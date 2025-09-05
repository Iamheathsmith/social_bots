import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY as string;
const DEFAULT_CAPTION = "Enjoy this amazing image! #MorningMagic";

// Initialize the Gemini client
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Encode a local image file to a Base64 string
function fileToGenerativePart(path: string, mimeType: string) {
	return {
		inlineData: {
			data: fs.readFileSync(path).toString("base64"),
			mimeType,
		},
	};
}

export async function generateTweetCaption(imagePath: string): Promise<string> {
	// For the 'generateContent' method, use a model that supports images, such as 'gemini-1.5-flash'.
	const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

	const prompt = `
		Analyze this image and write a tweet that is compelling, natural, and engaging. 
		The tweet must be less than 290 characters (including spaces), but try to make it as long as possible while still being concise, 
		appropriate for a general audience, and include exactly 3 relevant hashtags focused on travel and photography (but not #TravelPhotography or overly generic tags). 
		Avoid emojis and icons. 
		About half the time, phrase the caption as a question to encourage engagement. 
		Use descriptive and emotional language that evokes curiosity or wonder about the scene, and make it specific to this image. 
		Return only the tweet text with hashtags, with no extra commentary.
  	`;

	const image = fileToGenerativePart(imagePath, "image/jpeg");

	const result = await model.generateContent([prompt, image]);

	if (result) {
		return result.response.text();
	} else {
		return DEFAULT_CAPTION;
	}
}

import fs from "fs";
import path from "path";
import axios from "axios";
import { API_KEYS } from "./config/api_keys.js";

// Endpoint to refresh a long-lived Threads token
const REFRESH_URL = "https://graph.threads.net/refresh_access_token";

async function refreshThreadsToken() {
	const oldToken = API_KEYS.THREADS_ACCESS_TOKEN;
	try {
		const response = await axios.get(REFRESH_URL, {
			params: {
				grant_type: "th_refresh_token",
				access_token: API_KEYS.THREADS_ACCESS_TOKEN, // current token
			},
		});

		const { access_token } = response.data;

		// Update only the THREADS_ACCESS_TOKEN, preserve all other keys
		const updatedApiKeys = {
			...API_KEYS,
			THREADS_ACCESS_TOKEN: access_token,
		};

		// Write back to api_keys.js
		const filePath = path.resolve("./src/config/api_keys.js");
		fs.writeFileSync(filePath, `export const API_KEYS = ${JSON.stringify(updatedApiKeys, null, 2)};\n`);

		console.log("Threads access token refreshed successfully!", oldToken, "->", access_token);
	} catch (error) {
		console.error("Failed to refresh Threads access token:", error);
	}
}

// Run the refresh
refreshThreadsToken();

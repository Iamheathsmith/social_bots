import dotenv from "dotenv";
if (!process.env.CI) {
    dotenv.config();
}

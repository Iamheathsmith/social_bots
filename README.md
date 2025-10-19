# Soical Meida posting bot(BlueSky and Threads)

## Overview

Soical Meida bot is a social media automation tool designed to help users manage their online presence efficiently. It automates posting, engagement, and analytics tracking across multiple platforms.

## How it Works

The bot operates in a series of automated steps:

1. **Pick a Random Image**

   - Scans the `src/images/` folder and selects an image at random for posting.

2. **Image Processing**

   - Checks and adjusts image quality, including resizing or compressing to meet platform requirements.

3. **Generate Caption**

   - Calls the AI-based `generateTweetCaption` function to create a compelling caption for the image.
   - If AI generation fails, it falls back to `DEFAULT_CAPTION` to ensure a post is still made.

4. **Post to Social Platforms**

   - Uses `postToBlueSky` to post the image and caption to BlueSky.
   - Optionally posts threads with `postThread` to maintain continuity.

5. **Move Posted Images**

   - Successfully posted images are moved from `Images/images_to_post` to `Images/posted_images` to prevent reposting.
   - The Images folder that is referances is a local folder on my NAS

6. **Error Handling**

   - Errors during caption generation or posting are logged.
   - The bot continues operation without stopping, ensuring robustness.

7. **CRON Job**
   - This is automated via a Cron job that runs on my Local Nas

## Usage

Build the bot using the command line interface:

```bash
npm run build
```

Run the bot using the command line interface:

```bash
npm run build
```

## License

This project is licensed under the MIT License.

## Contact

For questions or support, contact the maintainer at heathsmith73@gmail.com.

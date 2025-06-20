import JSZip from "jszip";
// Import the meta-png library
import {
  addMetadata,
  addMetadataFromBase64DataURI,
  getMetadata,
} from "meta-png";

export default defineContentScript({
  matches: ["https://x.com/*", "https://twitter.com/*"],
  main: async () => {
    let isDownloadCancelled = false;
    let downloadAbortController = new AbortController();

    // Utility function to convert Blob to ArrayBuffer with TypeScript typing
    async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(blob);
      });
    }

    // Function to embed metadata in PNG images using meta-png
    async function embedPngMetadata(
      blob: Blob,
      metadata: {
        tweetId?: string;
        tweetUrl?: string;
        tweetText?: string;
        username?: string;
        timestamp?: string;
      }
    ): Promise<Blob> {
      try {
        // Convert blob to array buffer
        const arrayBuffer = await blobToArrayBuffer(blob);

        // Force the Uint8Array to the correct type using double type assertion
        // This bypasses TypeScript's type checking for the meta-png library requirements
        const originalArray = new Uint8Array(arrayBuffer);
        // Use as unknown as Uint8Array to force TypeScript to accept it
        let pngData = originalArray as unknown as Uint8Array;

        // Add each metadata field individually
        if (metadata.tweetId) {
          pngData = addMetadata(pngData, "Tweet_ID", metadata.tweetId);
        }

        if (metadata.tweetUrl) {
          pngData = addMetadata(pngData, "Tweet_URL", metadata.tweetUrl);
        }

        if (metadata.tweetText) {
          // Limit text length to ensure it fits within PNG constraints
          const text = metadata.tweetText.substring(0, 1000);
          pngData = addMetadata(pngData, "Tweet_Text", text);
        }

        if (metadata.username) {
          pngData = addMetadata(pngData, "Tweet_Author", metadata.username);
        }

        if (metadata.timestamp) {
          pngData = addMetadata(pngData, "Tweet_Date", metadata.timestamp);
        }

        // Add scraper identifier
        pngData = addMetadata(
          pngData,
          "X_Scraper",
          "X Image Downloader Extension"
        );

        // Convert back to blob
        return new Blob([pngData], { type: "image/png" });
      } catch (error) {
        console.error("Error embedding PNG metadata:", error);
        return blob; // Return original if there's an error
      }
    }

    // Function to embed metadata in JPEG images (fallback to original for now)
    async function embedJpegMetadata(
      blob: Blob,
      metadata: {
        tweetId?: string;
        tweetUrl?: string;
        tweetText?: string;
        username?: string;
        timestamp?: string;
      }
    ): Promise<Blob> {
      // Implementation for JPEG would go here if needed
      // For now, just return the original blob
      return blob;
    }

    // Main function to embed metadata in any image
    async function embedImageMetadata(
      blob: Blob,
      metadata: {
        tweetId?: string;
        tweetUrl?: string;
        tweetText?: string;
        username?: string;
        timestamp?: string;
      },
      extension: string
    ): Promise<Blob> {
      if (extension.toLowerCase() === "png") {
        return embedPngMetadata(blob, metadata);
      } else if (
        extension.toLowerCase() === "jpg" ||
        extension.toLowerCase() === "jpeg"
      ) {
        return embedJpegMetadata(blob, metadata);
      } else {
        return blob; // Return original for unsupported formats
      }
    }

    async function triggerDownload(
      blob: Blob,
      filename: string
    ): Promise<void> {
      return new Promise((resolve, reject) => {
        try {
          const downloadUrl = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = downloadUrl;
          link.download = filename;

          // Add to document and force click
          document.body.appendChild(link);
          link.click();

          // Clean up
          setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(downloadUrl);
            resolve();
          }, 1000);
        } catch (error) {
          reject(error);
        }
      });
    }

    // Enhanced function to extract tweet metadata
    async function getPostMetadata(postElement: Element): Promise<{
      tweetId: string;
      tweetUrl: string;
      username: string;
      timestamp: string;
      tweetText: string;
    }> {
      // Extract tweet text
      const textContent =
        postElement.querySelector('div[data-testid="tweetText"]')
          ?.textContent || "";

      // Extract username
      const username =
        postElement.querySelector('div[dir="ltr"] span')?.textContent || "";

      // Extract timestamp
      const timeElement = postElement.querySelector("time");
      const timestamp = timeElement?.getAttribute("datetime") || "";

      // Extract tweet ID - check for a link to the tweet status
      let tweetId = "";
      let tweetUrl = "";

      // Find anchor with href containing /status/
      const statusLink = postElement.querySelector('a[href*="/status/"]');
      if (statusLink) {
        const href = statusLink.getAttribute("href") || "";
        const statusMatch = href.match(/\/status\/(\d+)/);
        if (statusMatch && statusMatch[1]) {
          tweetId = statusMatch[1];

          // Construct the full tweet URL
          const baseUrl = window.location.hostname; // x.com or twitter.com
          const usernameFromUrl = username.replace("@", "");
          tweetUrl = `https://${baseUrl}/${usernameFromUrl}/status/${tweetId}`;
        }
      }

      return {
        tweetId,
        tweetUrl,
        username,
        timestamp,
        tweetText: textContent,
      };
    }

    // Helper function to extract tweet ID from URL (for media tab)
    function extractTweetId(url: string): string {
      const statusMatch = url.match(/\/status\/(\d+)/);
      return statusMatch ? statusMatch[1] : "";
    }

    function isUserProfilePage(): boolean {
      // Check if we're on a user profile page (not a tweet, home, or other page)
      const path = window.location.pathname.split("/");
      return (
        path.length >= 2 &&
        !["home", "explore", "notifications", "messages", "search"].includes(
          path[1]
        ) &&
        !path.includes("status")
      );
    }

    function isMediaTab(): boolean {
      // Check if we're already on the media tab
      return window.location.pathname.includes("/media");
    }

    function injectDownloadButton() {
      const buttonGroup =
        document.querySelector('div[data-testid="placementTracking"]')
          ?.parentElement ??
        document.querySelector('a[href="/settings/profile"]')?.parentElement;
      if (!buttonGroup || document.querySelector("#x-image-downloader")) return;

      const downloadBtn = document.createElement("button");
      downloadBtn.id = "x-image-downloader";
      downloadBtn.className =
        "css-175oi2r r-sdzlij r-1phboty r-rs99b7 r-lrvibr r-6gpygo r-1wron08 r-2yi16 r-1qi8awa r-1loqt21 r-o7ynqc r-6416eg r-1ny4l3l";
      downloadBtn.style.cssText =
        "background-color: rgba(0, 0, 0, 0); border-color: rgb(83, 100, 113);";
      downloadBtn.setAttribute("aria-label", "Download Images");
      downloadBtn.innerHTML = `
        <div dir="ltr" class="css-146c3p1 r-bcqeeo r-qvutc0 r-37j5jr r-q4m81j r-a023e6 r-rjixqe r-b88u0q r-1awozwy r-6koalj r-18u37iz r-16y2uox r-1777fci" style="color: rgb(239, 243, 244);">
          <svg viewBox="0 0 24 24" class="r-4qtqp9 r-yyyyoo r-dnmrzs r-bnwqim r-lrvibr r-m6rgpd r-z80fyv r-19wmn03" style="color: rgb(239, 243, 244);">
            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
          </svg>
        </div>
      `;

      downloadBtn.onclick = () => {
        showImageCountPrompt();
      };

      buttonGroup.insertBefore(downloadBtn, buttonGroup.lastElementChild);
    }

    function showImageCountPrompt() {
      const modal = document.createElement("div");
      modal.id = "xitter-modal";
      modal.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #1a1a1a;
        padding: 20px;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        min-width: 300px;
        border: 1px solid #333;
      `;

      // Add option to use media tab if we're on a profile page
      const useMediaTab = isUserProfilePage() && !isMediaTab();

      modal.innerHTML = `
        <h2 style="color: #fff; margin: 0 0 15px 0; font-size: 16px;">Download Images</h2>
        <div style="margin-bottom: 15px;">
          <label style="color: #888; display: block; margin-bottom: 5px;">Number of images to download:</label>
          <input type="number" min="1" value="50" style="width: 100%; padding: 8px; background: #333; border: 1px solid #444; color: #fff; border-radius: 4px;">
        </div>
        ${
          useMediaTab
            ? `
        <div style="margin-bottom: 15px;">
          <label style="display: flex; align-items: center; color: #888;">
            <input type="checkbox" id="use-media-tab" checked style="margin-right: 8px;">
            Use Media tab (bypasses 3200 tweet limit)
          </label>
        </div>
        `
            : ""
        }
        <div style="margin-bottom: 15px;">
          <label style="display: flex; align-items: center; color: #888;">
            <input type="checkbox" id="include-metadata" checked style="margin-right: 8px;">
            Embed metadata in images (tweet ID, URL, text)
          </label>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px;">
          <button id="clean-cache" style="padding: 4px 10px; border-radius: 4px; border: 1px solid red; background: transparent; color: #fff; cursor: pointer; font-size: 14px; width: 100px; height: 40px;">Clean Cache</button>
          <button id="cancel-download" style="padding: 8px 16px; border-radius: 6px; border: 1px solid #333; background: transparent; color: #fff; cursor: pointer;">Cancel</button>
          <button id="start-download" style="padding: 8px 16px; border-radius: 6px; border: none; background: #3291ff; color: #fff; cursor: pointer;">Download</button>
        </div>
      `;

      document.body.appendChild(modal);

      const backdrop = document.createElement("div");
      backdrop.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9999;
      `;
      document.body.appendChild(backdrop);

      const input = modal.querySelector(
        "input[type='number']"
      ) as HTMLInputElement;
      // biome-ignore lint/style/noNonNullAssertion: <explanation>
      modal.querySelector<HTMLButtonElement>("#cancel-download")!.onclick =
        () => {
          modal.remove();
          backdrop.remove();
        };

      modal.querySelector<HTMLButtonElement>("#clean-cache")!.onclick = () => {
        let username = /\.com\/(\w+)/.exec(window.location.href);
        let cache = [];
        if (username) {
          cache = JSON.parse(
            localStorage.getItem(`xitter-cache-${username[1]}`) ?? "[]"
          );
          if (cache.length > 0) {
            localStorage.removeItem(`xitter-cache-${username[1]}`);
          }
          var p = document.createElement("p");
          p.id = "xitter-cache-cleaned";
          p.textContent =
            cache.length > 0
              ? ` ${cache.length} tweets cached for ${username[1]} cleaned!`
              : `No tweets cached for ${username[1]}`;
          modal.insertBefore(p, modal.children[1]!);
          setTimeout(() => {
            p.remove();
          }, 3000);
        }
      };

      // biome-ignore lint/style/noNonNullAssertion: <explanation>
      modal.querySelector<HTMLButtonElement>("#start-download")!.onclick =
        () => {
          if (!input) {
            throw new Error("Input element not found");
          }
          const count = Number.parseInt(input.value);

          // Check if we should use media tab
          const useMediaTabCheckbox =
            modal.querySelector<HTMLInputElement>("#use-media-tab");
          const shouldUseMediaTab = useMediaTabCheckbox
            ? useMediaTabCheckbox.checked
            : false;

          // Check if we should include metadata
          const includeMetadataCheckbox =
            modal.querySelector<HTMLInputElement>("#include-metadata");
          const shouldIncludeMetadata = includeMetadataCheckbox
            ? includeMetadataCheckbox.checked
            : true;

          if (count > 0) {
            if (shouldUseMediaTab && isUserProfilePage() && !isMediaTab()) {
              // Switch to media tab first
              const username = window.location.pathname.split("/")[1];
              const mediaUrl = `https://${window.location.host}/${username}/media`;

              // Create notification
              const notification = document.createElement("div");
              notification.style.cssText = `
								position: fixed;
								bottom: 20px;
								right: 20px;
								background: #1a1a1a;
								padding: 15px;
								border-radius: 8px;
								box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
								z-index: 10000;
								color: #fff;
								font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
							`;
              notification.textContent =
                "Redirecting to Media tab to bypass 3200 tweet limit...";
              document.body.appendChild(notification);

              // Store options in sessionStorage for after redirect
              sessionStorage.setItem("x_downloader_count", count.toString());
              sessionStorage.setItem(
                "x_downloader_metadata",
                shouldIncludeMetadata.toString()
              );

              // Redirect to media tab
              setTimeout(() => {
                window.location.href = mediaUrl;
              }, 1500);
            } else {
              // Start download directly
              handleImageCollection(count, shouldIncludeMetadata);
            }

            modal.remove();
            backdrop.remove();
          }
        };
    }

    function createProgressBar() {
      const container = document.createElement("div");
      container.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #1a1a1a;
        padding: 15px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        min-width: 250px;
      `;

      const title = document.createElement("div");
      title.style.cssText = `
        color: #fff;
        margin-bottom: 8px;
        font-size: 14px;
        display: flex;
        justify-content: space-between;
      `;
      title.innerHTML = "<span>Downloading Images</span><span>0%</span>";

      const progressBarContainer = document.createElement("div");
      progressBarContainer.style.cssText = `
        background: #333;
        height: 6px;
        border-radius: 3px;
        overflow: hidden;
        margin-bottom: 10px;
      `;

      const progressBar = document.createElement("div");
      progressBar.style.cssText = `
        background: #3291ff;
        height: 100%;
        width: 0%;
        transition: width 0.3s ease;
      `;

      const details = document.createElement("div");
      details.style.cssText = `
        color: #888;
        margin-top: 8px;
        font-size: 12px;
      `;
      details.textContent = "Preparing...";

      const cancelButton = document.createElement("button");
      cancelButton.style.cssText = `
        padding: 6px 12px;
        border-radius: 4px;
        border: 1px solid #444;
        background: transparent;
        color: #ff4444;
        cursor: pointer;
        font-size: 12px;
        margin-top: 10px;
        width: 100%;
        transition: background-color 0.2s;
      `;
      cancelButton.textContent = "Cancel Download";
      cancelButton.onmouseover = () => {
        cancelButton.style.backgroundColor = "rgba(255, 68, 68, 0.1)";
      };
      cancelButton.onmouseout = () => {
        cancelButton.style.backgroundColor = "transparent";
      };
      cancelButton.onclick = () => {
        isDownloadCancelled = true;
        details.textContent = "Cancelling and preparing downloaded images...";
        cancelButton.disabled = true;
        cancelButton.style.opacity = "0.5";
        cancelButton.style.cursor = "default";
      };

      progressBarContainer.appendChild(progressBar);
      container.appendChild(title);
      container.appendChild(progressBarContainer);
      container.appendChild(details);
      container.appendChild(cancelButton);
      document.body.appendChild(container);

      return {
        container,
        updateProgress: (current: number, total: number, phase: string) => {
          const percent = Math.round((current / total) * 100);
          progressBar.style.width = `${percent}%`;
          title.innerHTML = `<span>Downloading Images</span><span>${percent}%</span>`;
          details.textContent = `${phase} (${current}/${total})`;
        },
        updateAttemps: (current: number, total: number) => {
          details.textContent = `<span>Scrolling Attempts</span><span>(${current}/${total})</span>`;
        },
        updateStatus: (message: string) => {
          details.textContent = message;
        },
        finish: () => {
          container.style.opacity = "0";
          container.style.transition = "opacity 0.5s ease";
          setTimeout(() => container.remove(), 500);
        },
      };
    }

    async function handleRateLimit(progress: {
      updateStatus: (message: string) => void;
    }) {
      const waitTime = 60; // seconds to wait
      for (let i = waitTime; i > 0; i--) {
        if (isDownloadCancelled) break;
        progress.updateStatus(`Rate limit reached. Waiting ${i} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    async function fetchWithRetry(
      url: string,
      maxRetries = 3
    ): Promise<Response> {
      let retries = 0;
      while (retries < maxRetries) {
        try {
          const response = await fetch(url, {
            signal: downloadAbortController.signal,
          });
          if (response.status === 429) {
            throw new Error("rate-limit");
          }
          return response;
        } catch (error) {
          if ((error as Error).name === "AbortError") {
            throw error;
          }
          if (
            (error as Error).message === "rate-limit" &&
            retries < maxRetries - 1
          ) {
            retries++;
            await new Promise((resolve) => setTimeout(resolve, 1000 * 60));
            continue;
          }
          throw error;
        }
      }
      throw new Error("Max retries reached");
    }

    function getHighestQualityUrl(url: string): string {
      const baseUrl = url.split("?")[0];
      return url.includes("format=jpg") || url.endsWith(".jpg")
        ? `${baseUrl}?format=jpg&name=orig`
        : `${baseUrl}?format=png&name=orig`;
    }

    // Enhanced collect images function
    async function collectImages(
      count: number,
      progress: {
        updateProgress: (current: number, total: number, phase: string) => void;
        updateStatus: (message: string) => void;
        updateAttemps: (current: number, total: number) => void;
      }
    ): Promise<
      Array<{
        url: string;
        ext: string;
        tweetId: string;
        tweetUrl: string;
        username: string;
        timestamp: string;
        tweetText: string;
        sequence?: number; // For multiple images in one tweet
      }>
    > {
      const images: Array<{
        url: string;
        ext: string;
        tweetId: string;
        tweetUrl: string;
        username: string;
        timestamp: string;
        tweetText: string;
        sequence?: number;
      }> = [];

      let lastHeight = 0;
      const username = window.location.pathname.split("/")[1];
      let attempts = 0;
      const maxAttempts = 50;

      // Track tweets we've already processed to handle multiple images per tweet
      const processedTweets = new Map();

      // Check if we're on the media tab - we can use a more specific selector
      const isOnMediaTab = isMediaTab();
      const imageSelector = isOnMediaTab
        ? 'a[href*="/photo/"] img[src*="pbs.twimg.com/media"]'
        : 'article[data-testid="tweet"] img[src*="pbs.twimg.com/media"]';

      while (images.length < count && attempts < maxAttempts) {
        if (isDownloadCancelled) {
          return images; // Return whatever we've collected so far
        }

        const imgElements =
          document.querySelectorAll<HTMLImageElement>(imageSelector);

        for (const img of imgElements) {
          if (isDownloadCancelled) {
            return images; // Return immediately if cancelled
          }

          let tweetId = "";
          let tweetUrl = "";
          let tweetUsername = username;
          let tweetTimestamp = "";
          let tweetText = "";
          let sequence = 1;

          // For media tab, the parent structure is different
          if (isOnMediaTab) {
            const mediaItem = img.closest('a[href*="/photo/"]');
            if (mediaItem) {
              const href = mediaItem.getAttribute("href") || "";
              // Extract status ID from href
              tweetId = extractTweetId(href);
              if (tweetId) {
                tweetUrl = `https://${window.location.host}/${username}/status/${tweetId}`;

                // Check if we already have this tweet ID to determine sequence
                if (processedTweets.has(tweetId)) {
                  sequence = processedTweets.get(tweetId) + 1;
                  processedTweets.set(tweetId, sequence);
                } else {
                  processedTweets.set(tweetId, 1);
                }
              }
            }
          } else {
            const article = img.closest('article[data-testid="tweet"]');
            if (article) {
              const metadata = await getPostMetadata(article);
              tweetId = metadata.tweetId;
              tweetUrl = metadata.tweetUrl;
              tweetUsername = metadata.username;
              tweetTimestamp = metadata.timestamp;
              tweetText = metadata.tweetText;

              // Check if we already have this tweet ID to determine sequence
              if (tweetId && processedTweets.has(tweetId)) {
                sequence = processedTweets.get(tweetId) + 1;
                processedTweets.set(tweetId, sequence);
              } else if (tweetId) {
                processedTweets.set(tweetId, 1);
              }
            }
          }

          const url = img.src;
          const highQualityUrl = getHighestQualityUrl(url);
          const extension =
            url.includes("format=jpg") || url.endsWith(".jpg") ? "jpg" : "png";

          if (!images.some((img) => img.url === highQualityUrl)) {
            images.push({
              url: highQualityUrl,
              ext: extension,
              tweetId,
              tweetUrl,
              username: tweetUsername,
              timestamp: tweetTimestamp,
              tweetText,
              sequence,
            });
          }

          progress.updateProgress(images.length, count, "Collecting images");
          if (images.length >= count) break;
        }

        if (images.length < count) {
          const previousHeight = lastHeight;
          window.scrollTo(0, document.body.scrollHeight);
          await new Promise((r) => setTimeout(r, 1000));

          if (
            Math.ceil(window.innerHeight + window.scrollY) >=
            document.body.scrollHeight
          ) {
            progress.updateStatus("Reached bottom of page");
            break;
          }

          lastHeight = document.body.scrollHeight;

          if (previousHeight === lastHeight) {
            attempts++;
          } else {
            attempts = 0;
          }
        }
      }

      return images;
    }

    // Enhanced zip creation function with TypeScript typing
    async function createAndDownloadZip(
      downloadedImages: Array<{
        blob: Blob;
        ext: string;
        tweetId: string;
        tweetUrl: string;
        username: string;
        timestamp: string;
        tweetText: string;
        sequence?: number;
      }>,
      embedMetadata: boolean,
      progress: {
        updateStatus: (message: string) => void;
        updateProgress: (current: number, total: number, phase: string) => void;
      }
    ): Promise<void> {
      try {
        progress.updateStatus("Creating zip file...");
        const zip = new JSZip();

        // Create folder structure
        const imagesFolder = zip.folder("images");

        // Prepare metadata collections
        let metadataText = "# X Image Downloader - Metadata\n\n";

        // Define the type for metadataJson
        const metadataJson: {
          source: string;
          username: string;
          downloadDate: string;
          images: Array<{
            filename: string;
            tweetId: string;
            tweetUrl: string;
            username: string;
            timestamp: string;
            tweetText: string;
          }>;
        } = {
          source: window.location.href,
          username: window.location.pathname.split("/")[1],
          downloadDate: new Date().toISOString(),
          images: [],
        };

        // Process each image
        for (let i = 0; i < downloadedImages.length; i++) {
          const img = downloadedImages[i];
          progress.updateProgress(
            i + 1,
            downloadedImages.length,
            "Processing metadata"
          );

          // Create filename based on tweet ID or index if ID not available
          const baseFilename = img.tweetId
            ? `tweet_${img.tweetId}_${img.sequence || 1}`
            : `image_${i + 1}`;
          const filename = `${baseFilename}.${img.ext}`;

          // Embed metadata if requested
          let processedBlob = img.blob;
          if (embedMetadata) {
            progress.updateStatus(
              `Embedding metadata in image ${i + 1}/${
                downloadedImages.length
              }...`
            );
            processedBlob = await embedImageMetadata(
              img.blob,
              {
                tweetId: img.tweetId,
                tweetUrl: img.tweetUrl,
                tweetText: img.tweetText,
                username: img.username,
                timestamp: img.timestamp,
              },
              img.ext
            );
          }

          // Add to zip
          imagesFolder?.file(filename, processedBlob);

          // Add to metadata text file
          metadataText += `## ${filename}\n`;
          if (img.tweetId) metadataText += `- Tweet ID: ${img.tweetId}\n`;
          if (img.tweetUrl) metadataText += `- URL: ${img.tweetUrl}\n`;
          if (img.username) metadataText += `- Author: ${img.username}\n`;
          if (img.timestamp) metadataText += `- Date: ${img.timestamp}\n`;
          if (img.tweetText) metadataText += `- Text: ${img.tweetText}\n`;
          metadataText += "\n";

          // Add to JSON metadata
          metadataJson.images.push({
            filename,
            tweetId: img.tweetId,
            tweetUrl: img.tweetUrl,
            username: img.username,
            timestamp: img.timestamp,
            tweetText: img.tweetText,
          });
        }

        // Add metadata files
        zip.file("metadata.txt", metadataText);
        zip.file("metadata.json", JSON.stringify(metadataJson, null, 2));

        progress.updateStatus("Generating zip...");
        const zipBlob = await zip.generateAsync({
          type: "blob",
          compression: "STORE", // Faster compression for quicker feedback
        });

        const username = window.location.pathname.split("/")[1];
        const sourceType = isMediaTab() ? "media_tab" : "timeline";

        progress.updateStatus("Initiating download...");
        const filename = `x_${username}_${
          downloadedImages.length
        }_${sourceType}${isDownloadCancelled ? "-partial" : ""}.zip`;

        await triggerDownload(zipBlob, filename);
        progress.updateStatus("Download complete!");
      } catch (error) {
        console.error("Error in zip creation/download:", error);
        progress.updateStatus("Error saving images. Please try again.");
        throw error;
      }
    }

    async function handleImageCollection(
      count: number,
      embedMetadata: boolean = true
    ) {
      isDownloadCancelled = false;
      downloadAbortController = new AbortController();
      const progress = createProgressBar();
      const downloadedImages: Array<{
        blob: Blob;
        ext: string;
        tweetId: string;
        tweetUrl: string;
        username: string;
        timestamp: string;
        tweetText: string;
        sequence?: number;
      }> = [];

      try {
        // Check if we were redirected from another page with settings in sessionStorage
        if (isMediaTab() && sessionStorage.getItem("x_downloader_count")) {
          const storedCount = parseInt(
            sessionStorage.getItem("x_downloader_count") || "0"
          );
          if (storedCount > 0) {
            count = storedCount;
          }

          const storedMetadata = sessionStorage.getItem(
            "x_downloader_metadata"
          );
          if (storedMetadata !== null) {
            embedMetadata = storedMetadata === "true";
          }

          // Clear the storage
          sessionStorage.removeItem("x_downloader_count");
          sessionStorage.removeItem("x_downloader_metadata");
        }

        // Start collecting images
        let collectedImages: Array<{
          url: string;
          ext: string;
          tweetId: string;
          tweetUrl: string;
          username: string;
          timestamp: string;
          tweetText: string;
          sequence?: number;
        }> = [];

        try {
          collectedImages = await collectImages(count, progress);
        } catch (collectionError) {
          console.error("Collection error:", collectionError);
          // If we have any collected images, continue with those
          if (collectedImages.length === 0) {
            throw new Error("No images found");
          }
        }

        // Process whatever images we've collected, even if cancelled during collection
        let imagesToProcess = isDownloadCancelled
          ? collectedImages.slice(0, collectedImages.length)
          : collectedImages;

        let username = imagesToProcess[0].username;
        const cachedImages = localStorage.getItem(`xitter-cache-${username}`);
        if (cachedImages) {
          progress.updateStatus("Checking for cached images...");
          const cachedImageIds = JSON.parse(cachedImages);
          imagesToProcess = imagesToProcess.filter(
            (image) => !cachedImageIds.includes(image.tweetId)
          );
          let totalImageSkiped = imagesToProcess.length - cachedImageIds.length;
          progress.updateStatus(
            `Skipping ${totalImageSkiped} cached images...`
          );
        }

        if (imagesToProcess.length > 0) {
          progress.updateStatus(
            `Processing ${imagesToProcess.length} collected images...`
          );

          for (let i = 0; i < imagesToProcess.length; i++) {
            if (isDownloadCancelled && downloadedImages.length > 0) {
              // If cancelled and we have some downloads, stop and save what we have
              break;
            }

            const image = imagesToProcess[i];
            try {
              const response = await fetchWithRetry(image.url);

              if (!response.ok) {
                if (response.status === 429) {
                  await handleRateLimit(progress);
                  if (!isDownloadCancelled) {
                    const retryResponse = await fetchWithRetry(image.url);
                    if (retryResponse.ok) {
                      const blob = await retryResponse.blob();
                      downloadedImages.push({
                        blob,
                        ext: image.ext,
                        tweetId: image.tweetId,
                        tweetUrl: image.tweetUrl,
                        username: image.username,
                        timestamp: image.timestamp,
                        tweetText: image.tweetText,
                        sequence: image.sequence,
                      });
                    }
                  }
                  continue;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
              }

              const blob = await response.blob();
              downloadedImages.push({
                blob,
                ext: image.ext,
                tweetId: image.tweetId,
                tweetUrl: image.tweetUrl,
                username: image.username,
                timestamp: image.timestamp,
                tweetText: image.tweetText,
                sequence: image.sequence,
              });

              progress.updateProgress(
                i + 1,
                imagesToProcess.length,
                "Downloading images"
              );
            } catch (error) {
              if ((error as Error).name === "AbortError") {
                break;
              }
              console.error(`Failed to fetch image ${i + 1}:`, error);
            }
          }

          // Always try to save downloaded images, even if cancelled
          if (downloadedImages.length > 0) {
            progress.updateStatus(
              `Saving ${downloadedImages.length} images to cache...`
            );
            let username = downloadedImages[0].username;
            let tweetcache = downloadedImages.map((i) => i.tweetId);
            let cachedImages = localStorage.getItem(`xitter-cache-${username}`);
            if (cachedImages) {
              cachedImages = JSON.stringify([
                ...JSON.parse(cachedImages),
                ...tweetcache,
              ]);
            } else {
              cachedImages = JSON.stringify(tweetcache);
            }

            localStorage.setItem(`xitter-cache-${username}`, cachedImages);

            progress.updateStatus(
              `Saving ${downloadedImages.length} downloaded images with metadata...`
            );
            try {
              await createAndDownloadZip(
                downloadedImages,
                embedMetadata,
                progress
              );
              progress.updateStatus("Download complete!");
            } catch (zipError) {
              progress.updateStatus("Error creating zip file");
              throw zipError;
            }
          } else {
            progress.updateStatus("No images were downloaded successfully");
          }
        } else {
          progress.updateStatus("No images were found to download");
        }

        setTimeout(() => progress.finish(), 2000);
        return {
          success: downloadedImages.length > 0,
          count: downloadedImages.length,
          reason: isDownloadCancelled ? "cancelled" : "completed",
        };
      } catch (error) {
        console.error("Process error:", error);

        // Even on error, try to save any successfully downloaded images
        if (downloadedImages.length > 0) {
          progress.updateStatus(
            `Error occurred. Saving ${downloadedImages.length} images...`
          );
          try {
            await createAndDownloadZip(
              downloadedImages,
              embedMetadata,
              progress
            );
            progress.updateStatus("Partial download saved successfully");
          } catch (zipError) {
            progress.updateStatus("Failed to save images");
          }
        } else {
          progress.updateStatus("Failed to download any images");
        }

        setTimeout(() => progress.finish(), 2000);
        return {
          success: false,
          count: downloadedImages.length,
          reason: "error",
        };
      } finally {
        downloadAbortController = new AbortController();
      }
    }

    // Add an event check for URL changes (for SPA navigation)
    let lastUrl = window.location.href;
    const urlObserver = new MutationObserver(() => {
      if (lastUrl !== window.location.href) {
        lastUrl = window.location.href;
        injectDownloadButton();

        // Check if we need to auto-start download after redirect to media tab
        if (isMediaTab() && sessionStorage.getItem("x_downloader_count")) {
          setTimeout(() => {
            const count = parseInt(
              sessionStorage.getItem("x_downloader_count") || "0"
            );
            const embedMetadata =
              sessionStorage.getItem("x_downloader_metadata") === "true";
            if (count > 0) {
              handleImageCollection(count, embedMetadata);
            }
          }, 2000); // Give the page a bit of time to load
        }
      }
    });

    urlObserver.observe(document, { subtree: true, childList: true });

    // Main DOM observer
    const observer = new MutationObserver(() => {
      injectDownloadButton();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    injectDownloadButton();

    // Check if we need to auto-start download after a redirect
    if (isMediaTab() && sessionStorage.getItem("x_downloader_count")) {
      setTimeout(() => {
        const count = parseInt(
          sessionStorage.getItem("x_downloader_count") || "0"
        );
        const embedMetadata =
          sessionStorage.getItem("x_downloader_metadata") === "true";
        if (count > 0) {
          handleImageCollection(count, embedMetadata);
        }
      }, 2000); // Give the page a bit of time to load
    }
  },
});

import JSZip from "jszip";

export default defineContentScript({
	matches: ["https://x.com/*", "https://twitter.com/*"],
	main: async () => {
		let isDownloadCancelled = false;
		let downloadAbortController = new AbortController();

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

		function injectDownloadButton() {
			const buttonGroup = document.querySelector(
				'div[data-testid="placementTracking"]'
			)?.parentElement;
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

			modal.innerHTML = `
        <h2 style="color: #fff; margin: 0 0 15px 0; font-size: 16px;">Download Images</h2>
        <div style="margin-bottom: 15px;">
          <label style="color: #888; display: block; margin-bottom: 5px;">Number of images to download:</label>
          <input type="number" min="1" value="50" style="width: 100%; padding: 8px; background: #333; border: 1px solid #444; color: #fff; border-radius: 4px;">
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px;">
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

			const input = modal.querySelector("input");
			// biome-ignore lint/style/noNonNullAssertion: <explanation>
			modal.querySelector<HTMLButtonElement>("#cancel-download")!.onclick =
				() => {
					modal.remove();
					backdrop.remove();
				};

			// biome-ignore lint/style/noNonNullAssertion: <explanation>
			modal.querySelector<HTMLButtonElement>("#start-download")!.onclick =
				() => {
					if (!input) {
						throw new Error("Input element not found");
					}
					const count = Number.parseInt(input.value);
					if (count > 0) {
						handleImageCollection(count);
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

		async function collectImages(
			count: number,
			progress: {
				updateProgress: (current: number, total: number, phase: string) => void;
			}
		): Promise<Array<{ url: string; ext: string }>> {
			const images: Array<{ url: string; ext: string }> = [];
			let lastHeight = 0;
			let attempts = 0;
			const maxAttempts = 50;

			while (images.length < count && attempts < maxAttempts) {
				if (isDownloadCancelled) {
					return images; // Return whatever we've collected so far
				}

				const imgElements = document.querySelectorAll<HTMLImageElement>(
					'article img[src*="pbs.twimg.com/media"]'
				);

				for (const img of imgElements) {
					if (isDownloadCancelled) {
						return images; // Return immediately if cancelled
					}

					const url = img.src;
					const highQualityUrl = getHighestQualityUrl(url);
					const extension =
						url.includes("format=jpg") || url.endsWith(".jpg") ? "jpg" : "png";

					if (!images.some((img) => img.url === highQualityUrl)) {
						images.push({ url: highQualityUrl, ext: extension });
					}

					progress.updateProgress(images.length, count, "Collecting images");
					if (images.length >= count) break;
				}

				if (images.length < count) {
					const previousHeight = lastHeight;
					window.scrollTo(0, document.body.scrollHeight);
					await new Promise((r) => setTimeout(r, 1000));
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

		async function createAndDownloadZip(
			downloadedImages: { blob: Blob; ext: string }[],
			progress: { updateStatus: (message: string) => void }
		) {
			try {
				progress.updateStatus("Creating zip file...");
				const zip = new JSZip();

				downloadedImages.forEach((img, index) => {
					zip.file(`image_${index + 1}.${img.ext}`, img.blob);
				});

				progress.updateStatus("Generating zip...");
				const zipBlob = await zip.generateAsync({
					type: "blob",
					compression: "STORE", // Faster compression for quicker feedback
				});

				progress.updateStatus("Initiating download...");
				const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
				const filename = `x-images-${timestamp}${
					isDownloadCancelled ? "-partial" : ""
				}.zip`;

				await triggerDownload(zipBlob, filename);
				progress.updateStatus("Download complete!");
			} catch (error) {
				console.error("Error in zip creation/download:", error);
				progress.updateStatus("Error saving images. Please try again.");
				throw error;
			}
		}

		async function handleImageCollection(count: number) {
			isDownloadCancelled = false;
			downloadAbortController = new AbortController();
			const progress = createProgressBar();
			const downloadedImages: { blob: Blob; ext: string }[] = [];

			try {
				// Start collecting images
				let collectedImages: Array<{ url: string; ext: string }> = [];

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
				const imagesToProcess = isDownloadCancelled
					? collectedImages.slice(0, collectedImages.length)
					: collectedImages;

				if (imagesToProcess.length > 0) {
					progress.updateStatus(
						`Processing ${imagesToProcess.length} collected images...`
					);

					for (let i = 0; i < imagesToProcess.length; i++) {
						if (isDownloadCancelled && downloadedImages.length > 0) {
							// If cancelled and we have some downloads, stop and save what we have
							break;
						}

						const { url, ext } = imagesToProcess[i];
						try {
							const response = await fetchWithRetry(url);

							if (!response.ok) {
								if (response.status === 429) {
									await handleRateLimit(progress);
									if (!isDownloadCancelled) {
										const retryResponse = await fetchWithRetry(url);
										if (retryResponse.ok) {
											const blob = await retryResponse.blob();
											downloadedImages.push({ blob, ext });
										}
									}
									continue;
								}
								throw new Error(`HTTP error! status: ${response.status}`);
							}

							const blob = await response.blob();
							downloadedImages.push({ blob, ext });
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
							`Saving ${downloadedImages.length} downloaded images...`
						);
						try {
							await createAndDownloadZip(downloadedImages, progress);
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
						await createAndDownloadZip(downloadedImages, progress);
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

		const observer = new MutationObserver(() => {
			injectDownloadButton();
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true,
		});

		injectDownloadButton();
	},
});

import JSZip from "jszip";

export default defineContentScript({
	matches: ["https://x.com/*", "https://twitter.com/*"],
	main: async () => {
		function injectDownloadButton() {
			// Find the button group container
			const buttonGroup = document.querySelector(
				'div[data-testid="placementTracking"]'
			)?.parentElement;
			if (!buttonGroup || document.querySelector("#x-image-downloader")) return;

			// Create download button matching X's style
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

			// Add click handler
			downloadBtn.onclick = () => {
				showImageCountPrompt();
			};

			// Insert before the last element
			buttonGroup.insertBefore(downloadBtn, buttonGroup.lastElementChild);
		}

		function showImageCountPrompt() {
			// Create modal
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

			// Add backdrop
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

			// Handle buttons
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

		// Progress bar UI
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

			progressBarContainer.appendChild(progressBar);
			container.appendChild(title);
			container.appendChild(progressBarContainer);
			container.appendChild(details);
			document.body.appendChild(container);

			return {
				container,
				updateProgress: (current: number, total: number, phase: string) => {
					const percent = Math.round((current / total) * 100);
					progressBar.style.width = `${percent}%`;
					title.innerHTML = `<span>Downloading Images</span><span>${percent}%</span>`;
					details.textContent = `${phase} (${current}/${total})`;
				},
				finish: () => {
					container.style.opacity = "0";
					container.style.transition = "opacity 0.5s ease";
					setTimeout(() => container.remove(), 500);
				},
			};
		}

		function getHighestQualityUrl(url: string): string {
			const baseUrl = url.split("?")[0];
			return url.includes("format=jpg") || url.endsWith(".jpg")
				? `${baseUrl}?format=jpg&name=8192x8192`
				: `${baseUrl}?format=png&name=orig`;
		}

		async function collectImages(
			count: number,
			progress: {
				container: HTMLDivElement;
				updateProgress: (current: number, total: number, phase: string) => void;
				finish: () => void;
			}
		): Promise<Array<{ url: string; ext: string }>> {
			const images: Array<{ url: string; ext: string }> = [];
			let lastHeight = 0;
			let attempts = 0;
			const maxAttempts = 50;

			while (images.length < count && attempts < maxAttempts) {
				const imgElements = document.querySelectorAll<HTMLImageElement>(
					'article img[src*="pbs.twimg.com/media"]'
				);

				for (const img of imgElements) {
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

		async function handleImageCollection(count: number) {
			const progress = createProgressBar();

			try {
				// Collect images
				const images = await collectImages(count, progress);
				if (!images.length) {
					throw new Error("No images found");
				}

				const zip = new JSZip();
				let downloadedCount = 0;

				// Fetch all images and add to zip
				const fetchPromises = images.map(async ({ url, ext }, index) => {
					try {
						const response = await fetch(url);
						if (!response.ok) {
							throw new Error(`HTTP error! status: ${response.status}`);
						}
						const blob = await response.blob();
						zip.file(`image_${index + 1}.${ext}`, blob);

						downloadedCount++;
						progress.updateProgress(
							downloadedCount,
							images.length,
							"Downloading images"
						);
					} catch (error) {
						console.error(`Failed to fetch image ${index + 1}:`, error);
					}
				});

				await Promise.all(fetchPromises);

				// Generate zip
				progress.updateProgress(
					images.length,
					images.length,
					"Creating zip file"
				);
				const zipBlob = await zip.generateAsync({ type: "blob" });
				const downloadUrl = URL.createObjectURL(zipBlob);

				const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
				const link = document.createElement("a");
				link.href = downloadUrl;
				link.download = `x-images-${timestamp}.zip`;
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);

				setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

				// Remove progress bar after a short delay
				setTimeout(() => progress.finish(), 1000);

				return { success: true, count: images.length };
			} catch (error) {
				progress.container.remove();
				throw new Error(
					`Failed to process images: ${(error as Error).message}`
				);
			}
		}

		// Initialize
		const observer = new MutationObserver(() => {
			injectDownloadButton();
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true,
		});

		// Initial check
		injectDownloadButton();
	},
});

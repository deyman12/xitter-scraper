<h1>Xitter-Scraper</h1>

![Xitter-scraper banner](/banner.jpg?raw=true)

<!-- available in the chrome store badge -->

<a href="https://chromewebstore.google.com/detail/xitter-scraper/cfkdbndljmndgmnagcekhfjplieaagbk"><img src="store-images/avbl-chrome-store-badge.png"></a>

![Chrome Web Store Version](https://img.shields.io/chrome-web-store/v/cfkdbndljmndgmnagcekhfjplieaagbk?link=https%3A%2F%2Fchromewebstore.google.com%2Fdetail%2Fxitter-scraper%2Fcfkdbndljmndgmnagcekhfjplieaagbk)

<!-- downloads badge -->

<p align="justify">

</p>

**A browser extension that lets you download high-quality images from X/Twitter profiles in bulk.**

---

Open someone's X profile, Click the ⬇ button, and get all their images in a ZIP file (Full Quality)!
![Example](/image.png?raw=true)
Built with TypeScript and [WXT](https://wxt.dev).

## ✨ Features

- 🚀 One-click bulk downloading
- 📦 Automatic ZIP file creation
- 🖼️ Downloads highest quality versions (4K when available)
- 🎯 Clean UI integration with X's interface
- 📊 Real-time progress tracking
- 🔄 Auto-scrolling to find more images
- 🎨 Preserves original image formats (JPG/PNG)

## 🛠️ Installation

Download from the chrome store OR:

1. Clone this repo:

```bash
git clone https://github.com/bewinxed/xitter-scraper
cd x-image-downloader
```

2. Install dependencies:

```bash
bun install
```

3. Build the extension:

```bash
bun run build
```

4. Load the extension:

- Open Chrome/Edge
- Go to `chrome://extensions`
- Enable "Developer mode"
- Click "Load unpacked"
- Select the `dist` folder

## 🎮 Usage

1. Navigate to any X/Twitter profile
2. Find the download button next to the Follow/Following button
3. Select how many images you want to download
4. Watch the progress bar as images are collected and downloaded
5. Get your images in a nicely organized ZIP file!

## 🧑‍💻 Development

Run the dev server:

```bash
pnpm dev
```

Build for production:

```bash
pnpm build
```

## 🧰 Tech Stack

- TypeScript
- WXT (WebExtension Tooling)
- JSZip

## 📝 Notes

- Only downloads media from the current profile/timeline view
- Downloads highest quality versions:
  - JPGs: Up to 4096x4096 resolution
  - PNGs: Original quality
- The extension requires permissions for:
  - x.com & twitter.com (for UI integration)
  - pbs.twimg.com (for image downloads)

## ⚖️ License

Don't be a jerk. If you claim this is yours or wrap it without credit, I will come to your house and steal your socks.

## 🤝 Contributing

PRs and issues welcome! Some ideas for contributions:

- Video support
- Custom naming patterns
- Download filters
- Better error handling
- Progress notifications
- Different archive formats

## ⭐ Found this useful?

Give it a star, fork it, share it! And maybe follow the developer on [GitHub](https://github.com/bewinxed).

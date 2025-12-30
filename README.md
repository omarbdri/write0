# write0

<p align="center">
  <img src="public/og-image.png" alt="write0" />
</p>

<p align="center">
  <a href="https://opensource.org/licenses/MIT">
    <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-blue.svg" />
  </a>
  <a href="#">
    <img alt="Architecture: Static" src="https://img.shields.io/badge/Architecture-Static-green" />
  </a>
</p>

<p align="center">
  <strong>write0</strong> is a distraction-free markdown writing environment designed for the modern web — a <strong>100% client-side application</strong> (no backend, no databases, no API routes).
</p>

---

## ✨ Features

### 🧘 Distraction-Free Environment

The interface is designed to disappear when you start writing. The sidebar and toolbar gently fade away after 1.5 seconds of typing, leaving nothing but you and your thoughts. They reappear instantly the moment you move your mouse.

### 🎯 Focus Mode

Keep your attention where it belongs. Focus Mode dims all paragraphs except the one you are currently editing, helping you maintain "flow" and preventing your eyes from wandering.

### 🔍 Real-time Style Check

Improve your writing as you go. write0 automatically highlights:

- **Blue**: Adverbs (e.g., "truly", "quickly", "softly")
- **Purple**: Weak verbs (e.g., "was", "is", "have", "get")
  This visual feedback helps you craft stronger, more active prose.

### 📄 Live Markdown Preview

Toggle a split-screen preview to see your markdown rendered in real-time. Whether you're writing technical docs or a novel, the preview ensures your formatting is always on point.

### 📥 Universal Export

Take your work anywhere. Export your documents with a single click as:

- **Markdown (.md)**: Standard format for cross-platform compatibility.
- **HTML**: Web-ready content.
- **PDF**: Print-optimized documents with a clean, professional layout.

---

## 🖼️ Screenshots

<p align="center">
  <img src="public/write_full.png" alt="Editor + sidebar" width="900" />
</p>

<p align="center">
  <img src="public/write_focus-mode.png" alt="Focus Mode" width="900" />
</p>

## 🛠️ Architecture: Web Native

write0 is a **100% client-side** app:

- **Vite + React**: Local development with fast HMR and a static production build.
- **Tailwind CDN**: Styling via the Tailwind runtime (no Tailwind build step).
- **LocalStorage**: Documents and settings are stored locally in your browser (no accounts, no server storage).
- **Exports**: HTML/Markdown export downloads a file; “PDF” uses the browser print dialog.

---

## 🚀 Getting Started

You can test it out [here](https://write.omarbadri.dev/).

### Local Development (Vite)

Install dependencies, then start the dev server:

```bash
npm install
npm run dev
```

### Quality Checks

```bash
npm run typecheck
npm run lint
npm run format:check
```

### Production Build

```bash
npm run build
npm run preview
```

---

## 📂 Project Structure

```text
/
├── index.html       # Entry point
├── App.tsx          # Main application logic
├── components/      # Modular UI components
├── utils/           # Export and Markdown logic
├── constants.ts     # Style check regex and defaults
└── types.ts         # TypeScript definitions
```

---

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for setup and guidelines.

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  Built with ❤️ for writers everywhere.
</p>

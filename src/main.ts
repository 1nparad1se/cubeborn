import '@fontsource/press-start-2p/cyrillic-400.css';
import '@fontsource/press-start-2p/latin-400.css';
import '@fontsource/rubik/cyrillic-500.css';
import '@fontsource/rubik/latin-500.css';
import '@fontsource/rubik/cyrillic-700.css';
import '@fontsource/rubik/latin-700.css';
import '@fontsource/pixelify-sans/cyrillic-500.css';
import '@fontsource/pixelify-sans/latin-500.css';
import '@fontsource/pixelify-sans/cyrillic-700.css';
import '@fontsource/pixelify-sans/latin-700.css';
import './style.css';
import { App } from './App';

// Prevent pinch-zoom / double-tap zoom and context menus on mobile.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

const root = document.getElementById('app')!;
try {
  (window as unknown as { app: App }).app = new App(root);
} catch (err) {
  console.error(err);
  root.innerHTML = `<div class="fatal">Не удалось запустить игру / Failed to start.<br><small>${String((err as Error)?.message ?? err)}</small></div>`;
}

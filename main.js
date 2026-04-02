import { GameApplication } from './game/GameApplication.js';

const application = new GameApplication();
application.start().catch((err) => {
  console.error(err);
  document.body.innerHTML = `<pre style="color:#f8fafc;padding:1rem;font-family:system-ui,monospace;">Failed to start: ${String(err?.message ?? err)}</pre>`;
});

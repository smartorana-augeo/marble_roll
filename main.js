import { applyVisualSettingsToDom } from './game/config/VisualSettings.js';
import { GameApplication } from './game/GameApplication.js';

applyVisualSettingsToDom();

const application = new GameApplication();
application.start().catch((err) => {
    console.error('[marble:flow] start() failed', err);
    console.error(err);
    document.body.innerHTML = `<pre style="color:#f8fafc;padding:1rem;font-family:system-ui,monospace;">Failed to start: ${String(err?.message ?? err)}</pre>`;
  });

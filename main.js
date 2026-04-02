import { GameApplication } from './game/GameApplication.js';
import { isWebGLAvailable } from './game/embed/EmbedHost.js';

if (!isWebGLAvailable()) {
  document.body.innerHTML =
    '<div style="color:#e8e4f2;padding:1.25rem;font-family:system-ui,sans-serif;max-width:28rem;line-height:1.5;">' +
    '<p>This game needs <strong>WebGL</strong> (hardware-accelerated 3D). Your browser or environment has it disabled or unavailable.</p>' +
    '<p>If you are embedding in a frame, ensure the host page allows WebGL and does not block canvas access.</p>' +
    '</div>';
} else {
  const application = new GameApplication();
  application
    .start()
    .then(() => {
      console.log('[marble:flow] start() finished — menu should be live; try New game.');
    })
    .catch((err) => {
      console.error('[marble:flow] start() failed', err);
      console.error(err);
      document.body.innerHTML = `<pre style="color:#f8fafc;padding:1rem;font-family:system-ui,monospace;">Failed to start: ${String(err?.message ?? err)}</pre>`;
    });
}

/**
 * HTML5 Audio playlist: plays tracks in order; each track plays once, then advances.
 * Not tied to game level — volume is either off (muted) or 1.
 * No DOM; game layer supplies URLs and persistence callbacks.
 */

export class MusicPlaylist {
  /**
   * @param {readonly string[]} trackUrls
   * @param {{ initialMuted?: boolean, onMutedChange?: (muted: boolean) => void }} [options]
   */
  constructor(trackUrls, options = {}) {
    if (!trackUrls?.length) {
      throw new Error('MusicPlaylist: at least one track URL is required');
    }
    this._urls = [...trackUrls];
    this._muted = Boolean(options.initialMuted);
    this._onMutedChange = options.onMutedChange ?? null;

    /** @type {number} */
    this._loadedUrlIndex = -1;

    this._audio = new Audio();
    this._audio.loop = false;
    this._audio.preload = 'auto';
    this._applyVolumeToElement();

    this._audio.addEventListener('ended', () => {
      this._advanceToNextTrack();
    });

    this._audio.addEventListener('error', () => {
      const err = this._audio.error;
      const codes = ['', 'ABORTED', 'NETWORK', 'DECODE', 'SRC_NOT_SUPPORTED'];
      console.warn('[music] element error', {
        code: err?.code,
        codeName: err?.code != null ? codes[err.code] : undefined,
        message: err?.message,
        src: this._audio.src?.slice(-80),
      });
    });

    /** First pointer or key unlocks HTMLMediaElement playback under browser autoplay policies. */
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      const unlock = () => {
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
        void this._tryPlay();
      };
      window.addEventListener('pointerdown', unlock, { passive: true });
      window.addEventListener('keydown', unlock);
    }
  }

  isMuted() {
    return this._muted;
  }

  /**
   * @param {boolean} muted
   */
  setMuted(muted) {
    const m = Boolean(muted);
    if (m === this._muted) return;
    this._muted = m;
    this._applyVolumeToElement();
    this._onMutedChange?.(this._muted);
  }

  toggleMuted() {
    this.setMuted(!this._muted);
  }

  _applyVolumeToElement() {
    this._audio.volume = this._muted ? 0 : 1;
  }

  /**
   * Start the playlist from the first track if nothing is loaded yet (e.g. menu boot).
   * Does not switch tracks when called again mid-session.
   */
  ensureInitialTrack() {
    if (this._loadedUrlIndex >= 0 && this._audio.src) {
      void this._tryPlay();
      return;
    }
    this._loadAndPlayIndex(0);
  }

  /**
   * @param {number} i
   */
  _loadAndPlayIndex(i) {
    const n = this._urls.length;
    const idx = ((i % n) + n) % n;
    if (idx === this._loadedUrlIndex && this._audio.src) {
      this._audio.currentTime = 0;
      this._applyVolumeToElement();
      void this._tryPlay();
      return;
    }
    this._loadedUrlIndex = idx;
    this._audio.src = this._urls[idx];
    this._audio.load();
    this._applyVolumeToElement();
    void this._tryPlay();
  }

  _advanceToNextTrack() {
    const n = this._urls.length;
    const next = (this._loadedUrlIndex + 1) % n;
    if (next === this._loadedUrlIndex) {
      this._audio.currentTime = 0;
      void this._tryPlay();
      return;
    }
    this._loadAndPlayIndex(next);
  }

  async _tryPlay() {
    try {
      await this._audio.play();
    } catch (err) {
      /** Expected until the user interacts with the document (see constructor unlock listeners). */
      if (err && typeof err === 'object' && err.name === 'NotAllowedError') {
        return;
      }
      console.warn('[music] play() failed', err);
    }
  }

  /**
   * Call after a user gesture so playback can start under browser policies.
   */
  ensurePlayback() {
    void this._tryPlay();
  }
}

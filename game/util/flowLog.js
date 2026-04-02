/** Verbose `[marble:flow]` tracing — enable with `?debug=1` in the URL (development only). */

let _flowDebug = false;

export function configureFlowDebugFromUrl() {
  try {
    _flowDebug =
      typeof location !== 'undefined' && new URLSearchParams(location.search).get('debug') === '1';
  } catch {
    _flowDebug = false;
  }
}

/**
 * @param {unknown[]} args
 */
export function flowLog(...args) {
  if (_flowDebug) console.log(...args);
}

/**
 * @param {unknown[]} args
 */
export function flowWarn(...args) {
  if (_flowDebug) console.warn(...args);
}

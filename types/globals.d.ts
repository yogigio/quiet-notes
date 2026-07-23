// Minimal ambient declarations for type checking.
//
// Deliberately loose: the goal is to catch mistakes in *our* logic (wrong
// argument types, typos, missing awaits), not to validate the WebExtension API
// surface. A full @types/firefox-webext-browser package would be heavier than
// the value it adds here.

declare var browser: any;

interface Window {
  browser: any;
  /** Set by web/platform.js so the bootstrap can flush overdue alarms. */
  __quietNotesCatchUp?: () => void;
}

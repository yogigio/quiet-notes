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

  // File System Access API — not in TypeScript's default DOM lib. Declared as
  // always present because callers feature-detect first (filesync.isSupported).
  showSaveFilePicker(options?: any): Promise<any>;
  showOpenFilePicker(options?: any): Promise<any[]>;
  showDirectoryPicker(options?: any): Promise<any>;
}

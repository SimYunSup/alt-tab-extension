import { defineWebExtConfig } from "wxt/modules";

export default defineWebExtConfig({
  // Persist Chrome/Chromium data across development sessions
  // This allows keeping login sessions, installed devtools extensions, etc.
  chromiumArgs: ['--user-data-dir=./.wxt/chrome-data'],
});

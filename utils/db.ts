import type { EntityTable } from "dexie";
import type { RecordTabInfo } from "@/utils/Tab";

import Dexie from "dexie";


const db = new Dexie("alt-tab") as Dexie & {
  recordTabs: EntityTable<RecordTabInfo>;
};

db.version(1).stores({
  recordTabs: "++id, tabId, url, title, windowId, tabIndex, lastActiveAt, faviconUrl",
})

export { db };

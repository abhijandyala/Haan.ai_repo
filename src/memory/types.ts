export interface MemoryEntry {
  id: string;
  key: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MemoryIndex {
  entries: { id: string; key: string; tags: string[]; summary: string }[];
  lastUpdated: string;
}

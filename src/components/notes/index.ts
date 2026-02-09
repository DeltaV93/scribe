/**
 * Notes Components
 *
 * Components for creating, editing, and managing client notes.
 *
 * Main components:
 * - NoteDrawer: Side drawer for creating/editing notes with auto-save
 * - NoteDetailDrawer: Read-only detail view for viewing notes
 * - NotesFilterBar: Filter bar with tag, date, and search filters
 * - NoteTypeSelect: Dropdown for Internal/Shareable selection
 * - NoteTagSelect: Multi-select for predefined tags
 * - RecentNotesPreview: Collapsible section showing recent notes for context
 * - ShareableWarningDialog: Confirmation dialog before publishing shareable notes
 */

export { NoteDrawer } from "./note-drawer";
export type { Note } from "./note-drawer";

export { NoteDetailDrawer } from "./note-detail-drawer";

export { NotesFilterBar, getTagColor } from "./notes-filter-bar";

export { NoteTypeSelect } from "./note-type-select";
export type { NoteType } from "./note-type-select";

export { NoteTagSelect } from "./note-tag-select";
export type { NoteTag } from "./note-tag-select";

export { RecentNotesPreview } from "./recent-notes-preview";

export { ShareableWarningDialog } from "./shareable-warning-dialog";

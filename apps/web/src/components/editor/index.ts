/**
 * TipTap Rich Text Editor
 *
 * A reusable rich text editor component built on TipTap with:
 * - Basic formatting (bold, italic, underline, lists, links)
 * - @mentions with autocomplete
 * - Keyboard shortcuts (Cmd+B, Cmd+I, Cmd+U, etc.)
 * - WCAG 2.1 AA accessibility
 * - Mobile-friendly toolbar
 *
 * Required packages (install if not present):
 * - @tiptap/react
 * - @tiptap/starter-kit
 * - @tiptap/extension-link
 * - @tiptap/extension-underline
 * - @tiptap/extension-mention
 * - @tiptap/extension-placeholder
 * - tippy.js (for mention popup positioning)
 *
 * @example
 * ```tsx
 * import { TipTapEditor } from "@/components/editor";
 *
 * const [content, setContent] = useState("");
 * const users = [{ id: "1", name: "John Doe", email: "john@example.com" }];
 *
 * <TipTapEditor
 *   content={content}
 *   onChange={setContent}
 *   placeholder="Write your note..."
 *   mentionableUsers={users}
 *   onMention={(userId) => console.log("Mentioned:", userId)}
 * />
 * ```
 */

export { TipTapEditor, useTipTapEditor } from "./tiptap-editor";
export type { TipTapEditorProps, MentionableUser } from "./tiptap-editor";
export { EditorToolbar } from "./toolbar";
export type { EditorToolbarProps } from "./toolbar";
export { MentionList } from "./mention-list";
export type { MentionListRef, MentionListProps } from "./mention-list";
export { createMentionExtension } from "./extensions/mention";
export type { MentionUser, MentionSuggestionProps } from "./extensions/mention";

"use client";

import * as React from "react";
import { useEffect, useMemo, useRef } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExtension from "@tiptap/extension-link";
import UnderlineExtension from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { ReactRenderer } from "@tiptap/react";
import tippy, { type Instance } from "tippy.js";
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";

import { cn } from "@/lib/utils";
import { EditorToolbar } from "./toolbar";
import { MentionList, type MentionListRef } from "./mention-list";
import { createMentionExtension, type MentionUser } from "./extensions/mention";

export interface MentionableUser {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string | null;
}

export interface TipTapEditorProps {
  /** Current content as HTML string */
  content: string;
  /** Called when content changes */
  onChange: (html: string) => void;
  /** Called when a user is mentioned */
  onMention?: (userId: string) => void;
  /** Placeholder text when editor is empty */
  placeholder?: string;
  /** Whether the editor is editable */
  editable?: boolean;
  /** Whether to focus on mount */
  autoFocus?: boolean;
  /** List of users that can be mentioned */
  mentionableUsers?: MentionableUser[];
  /** Additional CSS classes */
  className?: string;
  /** Minimum height for the editor */
  minHeight?: string;
  /** Maximum height for the editor (enables scrolling) */
  maxHeight?: string;
}

/**
 * TipTap Rich Text Editor Component
 *
 * A fully-featured rich text editor built on TipTap with:
 * - Basic formatting: bold, italic, underline, lists, links
 * - @mentions with autocomplete popup
 * - Keyboard shortcuts (Cmd+B, Cmd+I, Cmd+U, Cmd+K for link)
 * - WCAG 2.1 AA accessibility compliance
 * - Mobile-friendly with touch-friendly toolbar
 * - Controlled content (value/onChange pattern)
 *
 * @example
 * ```tsx
 * const [content, setContent] = useState("");
 *
 * <TipTapEditor
 *   content={content}
 *   onChange={setContent}
 *   placeholder="Start typing..."
 *   mentionableUsers={users}
 *   onMention={(userId) => console.log("Mentioned:", userId)}
 * />
 * ```
 */
export function TipTapEditor({
  content,
  onChange,
  onMention,
  placeholder = "Start typing...",
  editable = true,
  autoFocus = false,
  mentionableUsers = [],
  className,
  minHeight = "150px",
  maxHeight,
}: TipTapEditorProps) {
  const onMentionRef = useRef(onMention);
  const mentionableUsersRef = useRef(mentionableUsers);

  // Keep refs updated
  useEffect(() => {
    onMentionRef.current = onMention;
  }, [onMention]);

  useEffect(() => {
    mentionableUsersRef.current = mentionableUsers;
  }, [mentionableUsers]);

  // Create mention extension with suggestion handling
  const mentionExtension = useMemo(() => {
    return createMentionExtension({
      items: ({ query }: { query: string }) => {
        const users = mentionableUsersRef.current;
        if (!query) {
          return users.slice(0, 10);
        }
        const lowerQuery = query.toLowerCase();
        return users
          .filter(
            (user) =>
              user.name.toLowerCase().includes(lowerQuery) ||
              user.email?.toLowerCase().includes(lowerQuery)
          )
          .slice(0, 10);
      },
      render: () => {
        let component: ReactRenderer<MentionListRef> | null = null;
        let popup: Instance[] | null = null;

        return {
          onStart: (props: SuggestionProps) => {
            component = new ReactRenderer(MentionList, {
              props: {
                items: props.items as MentionUser[],
                command: (user: MentionUser) => {
                  props.command({ id: user.id, label: user.name });
                  // Trigger onMention callback
                  if (onMentionRef.current) {
                    onMentionRef.current(user.id);
                  }
                },
              },
              editor: props.editor,
            });

            if (!props.clientRect) {
              return;
            }

            popup = tippy("body", {
              getReferenceClientRect: props.clientRect as () => DOMRect,
              appendTo: () => document.body,
              content: component.element,
              showOnCreate: true,
              interactive: true,
              trigger: "manual",
              placement: "bottom-start",
              animation: "shift-away",
              theme: "light-border",
            });
          },

          onUpdate: (props: SuggestionProps) => {
            if (!component) return;

            component.updateProps({
              items: props.items as MentionUser[],
              command: (user: MentionUser) => {
                props.command({ id: user.id, label: user.name });
                if (onMentionRef.current) {
                  onMentionRef.current(user.id);
                }
              },
            });

            if (!props.clientRect || !popup?.[0]) {
              return;
            }

            popup[0].setProps({
              getReferenceClientRect: props.clientRect as () => DOMRect,
            });
          },

          onKeyDown: (props: SuggestionKeyDownProps) => {
            if (props.event.key === "Escape") {
              popup?.[0]?.hide();
              return true;
            }

            if (!component?.ref) return false;
            return component.ref.onKeyDown(props);
          },

          onExit: () => {
            popup?.[0]?.destroy();
            component?.destroy();
          },
        };
      },
    });
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable heading since we don't need it for notes
        heading: false,
        // Configure bullet list and ordered list
        bulletList: {
          HTMLAttributes: {
            class: "list-disc pl-4 space-y-1",
          },
        },
        orderedList: {
          HTMLAttributes: {
            class: "list-decimal pl-4 space-y-1",
          },
        },
      }),
      UnderlineExtension,
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: {
          class:
            "text-primary underline underline-offset-2 cursor-pointer hover:text-primary/80",
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass:
          "before:content-[attr(data-placeholder)] before:text-muted-foreground before:float-left before:h-0 before:pointer-events-none",
      }),
      mentionExtension,
    ],
    content,
    editable,
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none",
          "px-3 py-2"
        ),
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": placeholder,
      },
    },
    onUpdate: ({ editor: updatedEditor }) => {
      onChange(updatedEditor.getHTML());
    },
  });

  // Sync external content changes
  useEffect(() => {
    if (!editor) return;

    const currentContent = editor.getHTML();
    if (content !== currentContent) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  // Sync editable state
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editable, editor]);

  // Add Cmd+K keyboard shortcut for links
  useEffect(() => {
    if (!editor) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        // The toolbar link popover will handle this
        // For now, just focus the editor
        editor.chain().focus().run();
      }
    };

    const editorElement = editor.view.dom;
    editorElement.addEventListener("keydown", handleKeyDown);

    return () => {
      editorElement.removeEventListener("keydown", handleKeyDown);
    };
  }, [editor]);

  return (
    <div
      className={cn(
        "rounded-md border bg-background transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        !editable && "opacity-60",
        className
      )}
    >
      <EditorToolbar editor={editor} disabled={!editable} />
      <div
        style={{
          minHeight,
          maxHeight,
          overflowY: maxHeight ? "auto" : undefined,
        }}
      >
        <EditorContent
          editor={editor}
          className="[&_.ProseMirror]:min-h-[inherit]"
        />
      </div>
    </div>
  );
}

/**
 * Hook to get the raw TipTap editor instance
 * Useful for advanced use cases
 */
export function useTipTapEditor(options: {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
  autoFocus?: boolean;
}): Editor | null {
  const { content, onChange, placeholder, editable = true, autoFocus = false } = options;

  const editor = useEditor({
    extensions: [
      StarterKit,
      UnderlineExtension,
      LinkExtension.configure({
        openOnClick: false,
      }),
      Placeholder.configure({
        placeholder: placeholder || "Start typing...",
      }),
    ],
    content,
    editable,
    autofocus: autoFocus ? "end" : false,
    onUpdate: ({ editor: updatedEditor }) => {
      onChange(updatedEditor.getHTML());
    },
  });

  return editor;
}

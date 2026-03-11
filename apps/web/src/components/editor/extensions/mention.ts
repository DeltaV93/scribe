import { Mention } from "@tiptap/extension-mention";
import type { SuggestionOptions } from "@tiptap/suggestion";

export interface MentionUser {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string | null;
}

export interface MentionSuggestionProps {
  query: string;
  users: MentionUser[];
  onSelect: (user: MentionUser) => void;
  selectedIndex: number;
}

/**
 * Configure the TipTap Mention extension for @mentions
 *
 * This creates a custom mention extension that:
 * - Triggers on @ character
 * - Shows filtered user suggestions
 * - Inserts mentions with user ID and display name
 * - Renders mentions as styled inline elements
 */
export function createMentionExtension(
  suggestionOptions: Partial<SuggestionOptions>
) {
  return Mention.configure({
    HTMLAttributes: {
      class:
        "mention bg-primary/10 text-primary rounded px-1 py-0.5 font-medium cursor-pointer hover:bg-primary/20 transition-colors",
    },
    suggestion: {
      char: "@",
      allowSpaces: false,
      startOfLine: false,
      ...suggestionOptions,
    },
    renderLabel({ options, node }) {
      return `${options.suggestion.char}${node.attrs.label ?? node.attrs.id}`;
    },
  });
}

export { Mention };

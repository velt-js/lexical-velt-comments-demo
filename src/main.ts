import './styles.css';

import { registerDragonSupport } from '@lexical/dragon';
import { createEmptyHistoryState, registerHistory } from '@lexical/history';
import { HeadingNode, QuoteNode, registerRichText } from '@lexical/rich-text';
import { mergeRegister } from '@lexical/utils';
import { $createParagraphNode, $getRoot, createEditor, HISTORY_MERGE_TAG, LexicalEditor } from 'lexical';

import { addComment, CommentNode, renderComments } from '@veltdev/lexical-velt-comments';

import prepopulatedRichText from './prepopulatedRichText';
import { subscribeToCommentAnnotations } from './velt';

/**
 * Serializes editor state without CommentNodes (JSON processing only, no editor mutations)
 */
function serializeWithoutComments(editor: LexicalEditor): string {
  return editor.getEditorState().read(() => {
    const json = editor.getEditorState().toJSON();

    // Process the JSON to remove comment nodes and normalize text nodes
    const cleanJson = removeCommentNodesFromJSON(json);
    const normalizedJson = normalizeTextNodesInJSON(cleanJson);

    return JSON.stringify(normalizedJson);
  });
}

/**
* Recursively removes CommentNodes from JSON while preserving their text content
*/
function removeCommentNodesFromJSON(json: any): any {
  if (!json || typeof json !== 'object') {
    return json;
  }

  // Handle arrays (like children arrays)
  if (Array.isArray(json)) {
    const cleanArray = [];
    for (const item of json) {
      if (item && item.type === 'comment') {
        // Extract children from CommentNode and add them directly
        if (item.children && Array.isArray(item.children)) {
          for (const child of item.children) {
            cleanArray.push(removeCommentNodesFromJSON(child));
          }
        }
      } else {
        cleanArray.push(removeCommentNodesFromJSON(item));
      }
    }
    return cleanArray;
  }

  // Handle objects
  const cleanObj = { ...json };

  // If this is a CommentNode, return its children instead
  if (cleanObj.type === 'comment') {
    if (cleanObj.children && Array.isArray(cleanObj.children)) {
      // Return the children directly, not wrapped in the comment
      return cleanObj.children.map((child: any) => removeCommentNodesFromJSON(child));
    }
    return null; // Remove empty comment nodes
  }

  // For other objects, recursively clean their properties
  for (const [key, value] of Object.entries(cleanObj)) {
    if (key === 'children' && Array.isArray(value)) {
      cleanObj[key] = removeCommentNodesFromJSON(value);
    } else if (typeof value === 'object' && value !== null) {
      cleanObj[key] = removeCommentNodesFromJSON(value);
    }
  }

  return cleanObj;
}

/**
* Normalizes adjacent text nodes in JSON (merges text nodes with same formatting)
*/
function normalizeTextNodesInJSON(json: any): any {
  if (!json || typeof json !== 'object') {
    return json;
  }

  if (Array.isArray(json)) {
    return json.map((item: any) => normalizeTextNodesInJSON(item));
  }

  const normalizedObj = { ...json };

  // Process children array if it exists
  if (normalizedObj.children && Array.isArray(normalizedObj.children)) {
    const children = normalizedObj.children.map((child: any) => normalizeTextNodesInJSON(child));
    normalizedObj.children = mergeAdjacentTextNodes(children);
  }

  // Recursively process other object properties
  for (const [key, value] of Object.entries(normalizedObj)) {
    if (key !== 'children' && typeof value === 'object' && value !== null) {
      normalizedObj[key] = normalizeTextNodesInJSON(value);
    }
  }

  return normalizedObj;
}

/**
* Merges adjacent text nodes with the same formatting in a children array
*/
function mergeAdjacentTextNodes(children: any[]): any[] {
  if (!Array.isArray(children) || children.length <= 1) {
    return children;
  }

  const merged = [];
  let i = 0;

  while (i < children.length) {
    const current = children[i];

    if (current && current.type === 'text') {
      let mergedText = current.text || '';
      let j = i + 1;

      // Look for adjacent text nodes with same formatting
      while (j < children.length) {
        const next = children[j];

        if (next && next.type === 'text' && haveSameTextFormat(current, next)) {
          mergedText += next.text || '';
          j++;
        } else {
          break;
        }
      }

      // Create merged text node
      merged.push({
        ...current,
        text: mergedText
      });

      i = j; // Move to next unprocessed node
    } else {
      merged.push(current);
      i++;
    }
  }

  return merged;
}

/**
* Checks if two text nodes have the same formatting
*/
function haveSameTextFormat(node1: any, node2: any): boolean {
  return (
    node1.format === node2.format &&
    node1.style === node2.style &&
    node1.mode === node2.mode &&
    node1.detail === node2.detail
  );
}

/**
* Deserializes editor state from clean JSON
*/
function deserializeCleanState(editor: LexicalEditor, jsonString: string): void {
  try {
    const json = JSON.parse(jsonString);
    editor.setEditorState(editor.parseEditorState(json));
  } catch (error) {
    console.error('Error deserializing editor state:', error);
    // Fallback to empty state
    editor.update(() => {
      const root = $getRoot();
      root.clear();
      root.append($createParagraphNode());
    });
  }
}

/**
* Save editor state to session storage (without comment nodes)
*/
function saveEditorState(editor: LexicalEditor): void {
  try {
    const cleanState = serializeWithoutComments(editor);
    // console.log('cleanState', cleanState);
    sessionStorage.setItem('lexical-editor-state', cleanState);
    // console.log('Editor state saved to session storage');
  } catch (error) {
    console.error('Error saving editor state:', error);
  }
}

/**
* Load editor state from session storage
*/
function loadEditorState(editor: LexicalEditor): boolean {
  try {
    const savedState = sessionStorage.getItem('lexical-editor-state');
    if (savedState) {
      deserializeCleanState(editor, savedState);
      console.log('Editor state loaded from session storage');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error loading editor state:', error);
    return false;
  }
}

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="app-content">
    <div>
      <button id="add-comment-btn">Add Comment</button>
      <button id="clear-storage-btn">Clear Storage</button>
    </div>
    <div class="editor-wrapper">
      <div id="lexical-editor" contenteditable></div>
    </div>
    <h4>Editor state:</h4>
    <textarea id="lexical-state"></textarea>
  </div>
`;

const editorRef = document.getElementById('lexical-editor');
const stateRef = document.getElementById('lexical-state') as HTMLTextAreaElement;

const initialConfig = {
  namespace: 'Vanilla JS Plugin Demo',
  // Register nodes specific for @lexical/rich-text and our plugin
  nodes: [HeadingNode, QuoteNode, CommentNode],
  onError: (error: Error) => {
    throw error;
  },
};

const editor = createEditor(initialConfig);
editor.setRootElement(editorRef);

// Registering Plugins
mergeRegister(
  registerRichText(editor),
  registerDragonSupport(editor),
  registerHistory(editor, createEmptyHistoryState(), 300),
);

// Try to load saved state first, if not available use prepopulated content
const stateLoaded = loadEditorState(editor);
if (!stateLoaded) {
  editor.update(prepopulatedRichText, { tag: HISTORY_MERGE_TAG });
}

// Auto-save on editor changes (with debouncing)
let saveTimeout: ReturnType<typeof setTimeout>;
editor.registerUpdateListener(({ editorState }) => {
  // Update the state display
  stateRef!.value = JSON.stringify(editorState.toJSON(), undefined, 2);

  // Auto-save with debouncing (save 1 second after last change)
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveEditorState(editor);
  }, 1000);
});

(window as any).lexicalEditor = editor;

// Add event listeners for buttons
const addCommentBtn = document.getElementById('add-comment-btn')!;
addCommentBtn.addEventListener('mousedown', (e) => {
  e.preventDefault();
  addComment({ editor });
});

const clearStorageBtn = document.getElementById('clear-storage-btn')!;
clearStorageBtn.addEventListener('click', () => {
  sessionStorage.removeItem('lexical-editor-state');
  alert('Storage cleared!');
});

// Subscribe to comment annotations - this will re-apply comments after state is loaded
subscribeToCommentAnnotations('commentAnnotations', (annotations) => {
  console.log('Received annotations:', annotations);
  renderComments({ editor, commentAnnotations: annotations });
});

console.log('Editor initialized, ready for comments');
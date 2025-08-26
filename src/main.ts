import './styles.css';

import { registerDragonSupport } from '@lexical/dragon';
import { createEmptyHistoryState, registerHistory } from '@lexical/history';
import { HeadingNode, QuoteNode, registerRichText } from '@lexical/rich-text';
import { mergeRegister } from '@lexical/utils';
import { $createParagraphNode, $getRoot, createEditor, HISTORY_MERGE_TAG, LexicalEditor } from 'lexical';

import { addComment, CommentNode, exportJSONWithoutComments, renderComments } from '@veltdev/lexical-velt-comments';

import prepopulatedRichText from './prepopulatedRichText';
import { subscribeToCommentAnnotations } from './velt';

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
    const cleanState = exportJSONWithoutComments(editor);
    // console.log('cleanState', cleanState);
    sessionStorage.setItem('lexical-editor-state', JSON.stringify(cleanState));
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
    <div class="editor-wrapper" id="lexical-editor-wrapper">
      <div contenteditable></div>
    </div>
    <h4>Editor state:</h4>
    <textarea id="lexical-state"></textarea>
  </div>
`;

// const editorRef = document.getElementById('lexical-editor');
const editorRef = document.querySelector<HTMLDivElement>('.editor-wrapper > div[contenteditable]')!;
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
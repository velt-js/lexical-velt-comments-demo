import { $createParagraphNode, $createTextNode, $getRoot } from 'lexical';

export default function $prepopulatedRichText() {
  const root = $getRoot();
  if (root.getFirstChild() !== null) {
    return;
  }

  const paragraph = $createParagraphNode();
  paragraph.append(
    $createTextNode('Lexical is comprised of editor instances that each attach to a single content editable element. '),
    $createTextNode('A set of editor states represent the current and pending states of the editor at any given time. ').toggleFormat('bold'),
    $createTextNode('Lexical is comprised of editor instances that each attach to a single content editable element. A set of editor states represent the current and pending states of the editor at any given time.'),
  );
  root.append(paragraph);
}

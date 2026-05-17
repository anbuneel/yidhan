type EditorComponent = (typeof import('../components/Editor'))['Editor'];

let loadedEditorComponent: EditorComponent | null = null;

export function getLoadedEditorComponent() {
  return loadedEditorComponent;
}

export function loadEditorComponent() {
  return import('../components/Editor').then((module) => {
    loadedEditorComponent = module.Editor;
    return { default: module.Editor };
  });
}

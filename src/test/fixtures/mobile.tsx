import { createRoot } from 'react-dom/client';
import { ChapteredLibrary } from '../../components/ChapteredLibrary';
import type { Note } from '../../types';
import '../../index.css';
Object.defineProperty(navigator, 'maxTouchPoints', { value: 1, configurable: true });
const notes = Array.from({ length: 24 }, (_, i) => ({ tags: [], deletedAt: null, id: String(i), title: 'Practice thought ' + (i + 1), content: '<p>A quiet moment, saved for another day.</p>', pinned: i === 0, createdAt: new Date(Date.now() - i * 5 * 86400000), updatedAt: new Date(Date.now() - i * 5 * 86400000) } satisfies Note));
createRoot(document.getElementById('root')!).render(<><ChapteredLibrary notes={notes} onNoteClick={() => {}} onNoteDelete={() => {}} onTogglePin={() => {}} /><footer className="p-8 text-center">End of practice library</footer></>);

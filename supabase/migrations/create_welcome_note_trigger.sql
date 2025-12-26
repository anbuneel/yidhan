-- Migration: Create welcome note for new users
-- This trigger automatically creates a welcome note when a new user signs up

-- Create the function that inserts the welcome note
create or replace function public.create_welcome_note()
returns trigger as $$
begin
  insert into public.notes (user_id, title, content)
  values (
    new.id,
    'Welcome to Zenote!',
    '<h2>Your calm space for thoughts</h2>
<p>Zenote is a distraction-free note-taking app inspired by Japanese stationery and the wabi-sabi philosophy of finding beauty in simplicity.</p>
<h3>Getting started</h3>
<ul>
  <li><strong>Create a note</strong> — Click the "New Note" button or start typing</li>
  <li><strong>Rich formatting</strong> — Use the toolbar for bold, italic, headers, lists, quotes, and code blocks</li>
  <li><strong>Organize with tags</strong> — Add tags to categorize your notes and filter by them later</li>
  <li><strong>Quick search</strong> — Press <code>Cmd+K</code> (or <code>Ctrl+K</code>) to search your notes instantly</li>
  <li><strong>Switch themes</strong> — Toggle between light (Kintsugi) and dark (Midnight) themes in the header</li>
  <li><strong>Import your notes</strong> — Bring notes from other apps via JSON or Markdown from the profile menu</li>
  <li><strong>Export your notes</strong> — Back up to JSON or export as Markdown anytime</li>
</ul>
<h3>Tips</h3>
<p>Your notes sync automatically across devices. Changes are saved as you type — look for the save indicator in the editor.</p>
<p>Feel free to delete this note when you''re ready. Happy writing!</p>'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Create the trigger on auth.users table
-- This fires after a new user is inserted (signs up)
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_welcome_note();

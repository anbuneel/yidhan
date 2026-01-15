# Quiet Tasks Implementation Plan

**Version:** 2.0
**Last Updated:** 2026-01-14
**Status:** Draft
**Author:** Claude (Opus 4.5)

---

## Original Prompt

> "we said we can start with the 'Quiet Reminder' feature. what decisions do we need to make before implementing that?"

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-14 | Initial plan (client-side batch processing) |
| 2.0 | 2026-01-14 | **Major revision**: Server-side architecture with extensibility for future LLM features |

---

## Overview

Quiet Tasks is a unified view that surfaces:
1. **Explicit tasks** — Tiptap checkboxes (`<li data-checked="false">`)
2. **Implicit intentions** — Natural language patterns ("I should...", "need to...")

This is the first feature in the **Quiet Intelligence** suite — designed with an extensible architecture that can grow to support embeddings and LLM-powered features later.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Note Created/Updated                        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   DATABASE TRIGGER                               │
│              extract_tasks_from_note()                           │
│                                                                  │
│   • Checks user_intelligence_settings.tier1_enabled              │
│   • Extracts tasks via PostgreSQL regex                          │
│   • Inserts into note_tasks table                                │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     note_tasks TABLE                             │
│                                                                  │
│   Stores extracted tasks with status tracking                    │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   QUIET TASKS VIEW                               │
│                                                                  │
│   • Displays pending tasks grouped by age                        │
│   • Actions: Complete, Snooze, Dismiss                           │
│   • Links back to source note                                    │
└─────────────────────────────────────────────────────────────────┘
```

### Why Server-Side?

| Approach | Pros | Cons |
|----------|------|------|
| ~~Client-side batch~~ | Simple | Misses mid-session tasks, battery drain, inconsistent |
| **Database trigger** ✓ | Always in sync, zero client load, works across devices | PostgreSQL regex limitations |
| Edge Function | Full JS power | Additional infrastructure |

**Decision:** Database trigger for Phase 1. Notes are already on Supabase — no additional privacy exposure.

---

## Privacy Tiers (Future-Proof Design)

The architecture supports three tiers of intelligence processing:

| Tier | Processing | Privacy | Cost | Phase |
|------|-----------|---------|------|-------|
| **Tier 1** | Regex/SQL (server-side) | None — data stays in Supabase | Free | **Phase 1 (now)** |
| Tier 2 | Embeddings | Medium — vectors sent to API | ~$0.0001/note | Future |
| Tier 3 | LLM | High — content sent to LLM | ~$0.01/note | Future |

**Phase 1 implements Tier 1 only** — users can get Quiet Tasks without any third-party data sharing.

---

## Phase 1: Database Schema

### 1.1 User Intelligence Settings

This table replaces `user_metadata` for intelligence features — cleaner and more extensible.

**File:** `supabase/migrations/001_intelligence_settings.sql`

```sql
-- ============================================
-- User Intelligence Settings
-- ============================================
-- Centralized settings for all Quiet Intelligence features
-- Designed to scale from regex (Tier 1) to LLM (Tier 3)

create table user_intelligence_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,

  -- Tier 1: Pattern matching (free, server-side only)
  tier1_enabled boolean default false,

  -- Tier 2: Embeddings (future - Bloom tier)
  tier2_enabled boolean default false,

  -- Tier 3: LLM processing (future - Bloom tier + explicit consent)
  tier3_enabled boolean default false,
  tier3_provider text check (tier3_provider in ('openai', 'anthropic')),

  -- Feature-specific toggles within Tier 1
  feature_quiet_tasks boolean default true,
  feature_quiet_questions boolean default true,
  feature_seasonal_echo boolean default true,

  -- Feature-specific toggles within Tier 2 (future)
  feature_resonance_threads boolean default false,

  -- Feature-specific toggles within Tier 3 (future)
  feature_daily_whisper boolean default false,
  feature_weekly_digest boolean default false,
  feature_weekly_digest_email text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS policies
alter table user_intelligence_settings enable row level security;

create policy "Users can view their own settings"
  on user_intelligence_settings for select
  using (auth.uid() = user_id);

create policy "Users can insert their own settings"
  on user_intelligence_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own settings"
  on user_intelligence_settings for update
  using (auth.uid() = user_id);

-- Auto-create settings for new users
create or replace function create_intelligence_settings()
returns trigger as $$
begin
  insert into user_intelligence_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created_intelligence
  after insert on auth.users
  for each row execute function create_intelligence_settings();
```

### 1.2 Note Tasks Table

**File:** `supabase/migrations/002_note_tasks.sql`

```sql
-- ============================================
-- Note Tasks Table
-- ============================================
-- Stores extracted tasks from notes (checkboxes + intentions)

create table note_tasks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  note_id uuid references notes(id) on delete cascade not null,

  -- Task content
  text text not null,
  type text not null check (type in ('checkbox', 'intention')),

  -- Source tracking
  source_pattern text,  -- e.g., 'I should', 'remind me to'

  -- Status
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'dismissed', 'snoozed')),
  snoozed_until timestamptz,
  snooze_count int not null default 0,

  -- Timestamps
  extracted_at timestamptz default now() not null,
  completed_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,

  -- Prevent duplicate extractions
  unique(note_id, text, type)
);

-- Indexes
create index idx_note_tasks_user_status on note_tasks(user_id, status);
create index idx_note_tasks_note on note_tasks(note_id);
create index idx_note_tasks_pending on note_tasks(user_id, extracted_at)
  where status = 'pending';

-- RLS policies
alter table note_tasks enable row level security;

create policy "Users can view their own tasks"
  on note_tasks for select using (auth.uid() = user_id);

create policy "Users can insert their own tasks"
  on note_tasks for insert with check (auth.uid() = user_id);

create policy "Users can update their own tasks"
  on note_tasks for update using (auth.uid() = user_id);

create policy "Users can delete their own tasks"
  on note_tasks for delete using (auth.uid() = user_id);

-- Updated_at trigger
create trigger update_note_tasks_updated_at
  before update on note_tasks
  for each row execute function update_updated_at_column();
```

### 1.3 Intelligence Queue (Foundation)

Schema only for Phase 1 — not actively used until Phase 2+.

**File:** `supabase/migrations/003_intelligence_queue.sql`

```sql
-- ============================================
-- Intelligence Queue (Foundation for Future)
-- ============================================
-- Async processing queue for Tier 2/3 features
-- Created now for schema stability; not used in Phase 1

create table intelligence_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  note_id uuid references notes(id) on delete cascade,

  -- Job routing
  processor text not null check (processor in ('pattern', 'embedding', 'llm')),
  job_type text not null,

  -- Status tracking
  status text default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  priority int default 0,
  attempts int default 0,
  max_attempts int default 3,

  -- Job data
  input_data jsonb,
  output_data jsonb,
  error_message text,

  -- Timestamps
  created_at timestamptz default now(),
  started_at timestamptz,
  completed_at timestamptz
);

-- Index for queue processing
create index idx_queue_pending on intelligence_queue(status, priority desc, created_at)
  where status = 'pending';

-- RLS policies
alter table intelligence_queue enable row level security;

create policy "Users can view their own queue items"
  on intelligence_queue for select using (auth.uid() = user_id);
```

---

## Phase 2: Task Extraction Trigger

### 2.1 Extraction Function

**File:** `supabase/migrations/004_task_extraction_trigger.sql`

```sql
-- ============================================
-- Task Extraction Trigger
-- ============================================
-- Automatically extracts tasks when notes are created/updated

create or replace function extract_tasks_from_note()
returns trigger as $$
declare
  settings_record record;
  checkbox_matches text[];
  intention_match record;
  cleaned_text text;
  plain_content text;
begin
  -- Check if user has Tier 1 enabled
  select * into settings_record
  from user_intelligence_settings
  where user_id = NEW.user_id;

  -- Exit if intelligence not enabled
  if settings_record is null or not settings_record.tier1_enabled then
    return NEW;
  end if;

  -- Exit if quiet_tasks feature is disabled
  if not settings_record.feature_quiet_tasks then
    return NEW;
  end if;

  -- Delete existing tasks for this note (will re-extract)
  delete from note_tasks where note_id = NEW.id;

  -- ========================================
  -- Extract unchecked checkboxes
  -- ========================================
  -- Match: <li data-type="taskItem" data-checked="false">content</li>
  for checkbox_matches in
    select regexp_matches(
      NEW.content,
      '<li[^>]*data-type="taskItem"[^>]*data-checked="false"[^>]*>(.*?)</li>',
      'gi'
    )
  loop
    -- Strip HTML tags from matched content
    cleaned_text := regexp_replace(checkbox_matches[1], '<[^>]*>', '', 'g');
    cleaned_text := trim(cleaned_text);

    -- Only insert if reasonable length
    if length(cleaned_text) >= 3 and length(cleaned_text) <= 200 then
      insert into note_tasks (user_id, note_id, text, type)
      values (NEW.user_id, NEW.id, cleaned_text, 'checkbox')
      on conflict (note_id, text, type) do nothing;
    end if;
  end loop;

  -- ========================================
  -- Extract intentions from plain text
  -- ========================================
  -- First, convert HTML to plain text
  plain_content := regexp_replace(NEW.content, '<[^>]*>', ' ', 'g');
  plain_content := regexp_replace(plain_content, '&nbsp;', ' ', 'g');
  plain_content := regexp_replace(plain_content, '&amp;', '&', 'g');
  plain_content := regexp_replace(plain_content, '\s+', ' ', 'g');
  plain_content := trim(plain_content);

  -- Pattern: "I should ..."
  for intention_match in
    select (regexp_matches(plain_content, '\mI should\s+(.{10,100}?)(?:\.|,|;|$)', 'gi'))[1] as captured
  loop
    if intention_match.captured is not null
       and intention_match.captured !~* '(yesterday|already|finished|completed|done|did)' then
      insert into note_tasks (user_id, note_id, text, type, source_pattern)
      values (NEW.user_id, NEW.id, initcap(trim(intention_match.captured)), 'intention', 'I should')
      on conflict (note_id, text, type) do nothing;
    end if;
  end loop;

  -- Pattern: "I need to ..."
  for intention_match in
    select (regexp_matches(plain_content, '\mI need to\s+(.{10,100}?)(?:\.|,|;|$)', 'gi'))[1] as captured
  loop
    if intention_match.captured is not null
       and intention_match.captured !~* '(yesterday|already|finished|completed|done|did)' then
      insert into note_tasks (user_id, note_id, text, type, source_pattern)
      values (NEW.user_id, NEW.id, initcap(trim(intention_match.captured)), 'intention', 'I need to')
      on conflict (note_id, text, type) do nothing;
    end if;
  end loop;

  -- Pattern: "remind me to ..."
  for intention_match in
    select (regexp_matches(plain_content, '\mremind me to\s+(.{10,100}?)(?:\.|,|;|$)', 'gi'))[1] as captured
  loop
    if intention_match.captured is not null then
      insert into note_tasks (user_id, note_id, text, type, source_pattern)
      values (NEW.user_id, NEW.id, initcap(trim(intention_match.captured)), 'intention', 'remind me to')
      on conflict (note_id, text, type) do nothing;
    end if;
  end loop;

  -- Pattern: "don't forget to ..."
  for intention_match in
    select (regexp_matches(plain_content, '\mdon''?t forget to\s+(.{10,100}?)(?:\.|,|;|$)', 'gi'))[1] as captured
  loop
    if intention_match.captured is not null then
      insert into note_tasks (user_id, note_id, text, type, source_pattern)
      values (NEW.user_id, NEW.id, initcap(trim(intention_match.captured)), 'intention', 'don''t forget')
      on conflict (note_id, text, type) do nothing;
    end if;
  end loop;

  -- Pattern: "I have to ..."
  for intention_match in
    select (regexp_matches(plain_content, '\mI have to\s+(.{10,100}?)(?:\.|,|;|$)', 'gi'))[1] as captured
  loop
    if intention_match.captured is not null
       and intention_match.captured !~* '(yesterday|already|finished|completed|done|did)' then
      insert into note_tasks (user_id, note_id, text, type, source_pattern)
      values (NEW.user_id, NEW.id, initcap(trim(intention_match.captured)), 'intention', 'I have to')
      on conflict (note_id, text, type) do nothing;
    end if;
  end loop;

  -- Pattern: "I must ..."
  for intention_match in
    select (regexp_matches(plain_content, '\mI must\s+(.{10,100}?)(?:\.|,|;|$)', 'gi'))[1] as captured
  loop
    if intention_match.captured is not null
       and intention_match.captured !~* '(yesterday|already|finished|completed|done|did)' then
      insert into note_tasks (user_id, note_id, text, type, source_pattern)
      values (NEW.user_id, NEW.id, initcap(trim(intention_match.captured)), 'intention', 'I must')
      on conflict (note_id, text, type) do nothing;
    end if;
  end loop;

  return NEW;
end;
$$ language plpgsql security definer;

-- Create trigger on notes table
create trigger extract_tasks_on_note_change
  after insert or update of content on notes
  for each row
  execute function extract_tasks_from_note();
```

---

## Phase 3: Task Service (Client)

### 3.1 TypeScript Types

**File:** `src/types/database.ts` (add to existing)

```typescript
export interface NoteTask {
  id: string;
  user_id: string;
  note_id: string;
  text: string;
  type: 'checkbox' | 'intention';
  source_pattern: string | null;
  status: 'pending' | 'completed' | 'dismissed' | 'snoozed';
  snoozed_until: string | null;
  snooze_count: number;
  extracted_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserIntelligenceSettings {
  user_id: string;
  tier1_enabled: boolean;
  tier2_enabled: boolean;
  tier3_enabled: boolean;
  tier3_provider: 'openai' | 'anthropic' | null;
  feature_quiet_tasks: boolean;
  feature_quiet_questions: boolean;
  feature_seasonal_echo: boolean;
  feature_resonance_threads: boolean;
  feature_daily_whisper: boolean;
  feature_weekly_digest: boolean;
  feature_weekly_digest_email: string | null;
  created_at: string;
  updated_at: string;
}
```

**File:** `src/types.ts` (add to existing)

```typescript
export interface Task {
  id: string;
  noteId: string;
  noteTitle: string;
  text: string;
  type: 'checkbox' | 'intention';
  status: 'pending' | 'completed' | 'dismissed' | 'snoozed';
  snoozedUntil: Date | null;
  snoozeCount: number;
  extractedAt: Date;
  completedAt: Date | null;
}

export interface IntelligenceSettings {
  tier1Enabled: boolean;
  tier2Enabled: boolean;
  tier3Enabled: boolean;
  featureQuietTasks: boolean;
  featureQuietQuestions: boolean;
  featureSeasonalEcho: boolean;
  featureResonanceThreads: boolean;
  featureDailyWhisper: boolean;
  featureWeeklyDigest: boolean;
}
```

### 3.2 Task Service

**File:** `src/services/tasks.ts`

```typescript
import { supabase } from '../lib/supabase';
import type { NoteTask } from '../types/database';
import type { Task } from '../types';

/**
 * Convert database task to app task with note context
 */
function toAppTask(dbTask: NoteTask & { notes: { title: string } }): Task {
  return {
    id: dbTask.id,
    noteId: dbTask.note_id,
    noteTitle: dbTask.notes?.title || 'Untitled',
    text: dbTask.text,
    type: dbTask.type as 'checkbox' | 'intention',
    status: dbTask.status as Task['status'],
    snoozedUntil: dbTask.snoozed_until ? new Date(dbTask.snoozed_until) : null,
    snoozeCount: dbTask.snooze_count,
    extractedAt: new Date(dbTask.extracted_at),
    completedAt: dbTask.completed_at ? new Date(dbTask.completed_at) : null,
  };
}

/**
 * Fetch all pending tasks for current user
 * Ordered by extraction date (oldest first - they bubble up)
 */
export async function fetchPendingTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from('note_tasks')
    .select('*, notes(title)')
    .in('status', ['pending', 'snoozed'])
    .order('extracted_at', { ascending: true });

  if (error) throw error;

  // Filter out snoozed tasks that haven't expired
  const now = new Date();
  const activeTasks = (data || []).filter(task => {
    if (task.status === 'snoozed' && task.snoozed_until) {
      return new Date(task.snoozed_until) <= now;
    }
    return true;
  });

  return activeTasks.map(toAppTask);
}

/**
 * Mark a task as completed
 */
export async function completeTask(taskId: string): Promise<void> {
  const { error } = await supabase
    .from('note_tasks')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString()
    })
    .eq('id', taskId);

  if (error) throw error;
}

/**
 * Dismiss a task (won't show again)
 */
export async function dismissTask(taskId: string): Promise<void> {
  const { error } = await supabase
    .from('note_tasks')
    .update({ status: 'dismissed' })
    .eq('id', taskId);

  if (error) throw error;
}

/**
 * Snooze a task for 1 week (max 2 times)
 */
export async function snoozeTask(taskId: string, currentSnoozeCount: number): Promise<boolean> {
  if (currentSnoozeCount >= 2) {
    return false; // Max snoozes reached
  }

  const snoozedUntil = new Date();
  snoozedUntil.setDate(snoozedUntil.getDate() + 7); // 1 week

  const { error } = await supabase
    .from('note_tasks')
    .update({
      status: 'snoozed',
      snoozed_until: snoozedUntil.toISOString(),
      snooze_count: currentSnoozeCount + 1
    })
    .eq('id', taskId);

  if (error) throw error;
  return true;
}

/**
 * Get task count for badge display
 */
export async function countPendingTasks(): Promise<number> {
  const { count, error } = await supabase
    .from('note_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  if (error) throw error;
  return count || 0;
}
```

### 3.3 Intelligence Settings Service

**File:** `src/services/intelligenceSettings.ts`

```typescript
import { supabase } from '../lib/supabase';
import type { UserIntelligenceSettings } from '../types/database';
import type { IntelligenceSettings } from '../types';

/**
 * Convert database settings to app settings
 */
function toAppSettings(db: UserIntelligenceSettings): IntelligenceSettings {
  return {
    tier1Enabled: db.tier1_enabled,
    tier2Enabled: db.tier2_enabled,
    tier3Enabled: db.tier3_enabled,
    featureQuietTasks: db.feature_quiet_tasks,
    featureQuietQuestions: db.feature_quiet_questions,
    featureSeasonalEcho: db.feature_seasonal_echo,
    featureResonanceThreads: db.feature_resonance_threads,
    featureDailyWhisper: db.feature_daily_whisper,
    featureWeeklyDigest: db.feature_weekly_digest,
  };
}

/**
 * Fetch intelligence settings for current user
 */
export async function fetchIntelligenceSettings(): Promise<IntelligenceSettings | null> {
  const { data, error } = await supabase
    .from('user_intelligence_settings')
    .select('*')
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // No settings yet
    throw error;
  }

  return toAppSettings(data);
}

/**
 * Enable/disable Tier 1 (pattern extraction)
 */
export async function setTier1Enabled(enabled: boolean): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('user_intelligence_settings')
    .upsert({
      user_id: user.id,
      tier1_enabled: enabled,
    }, { onConflict: 'user_id' });

  if (error) throw error;
}

/**
 * Toggle a specific feature
 */
export async function setFeatureEnabled(
  feature: keyof Pick<IntelligenceSettings,
    'featureQuietTasks' | 'featureQuietQuestions' | 'featureSeasonalEcho'>,
  enabled: boolean
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const columnMap = {
    featureQuietTasks: 'feature_quiet_tasks',
    featureQuietQuestions: 'feature_quiet_questions',
    featureSeasonalEcho: 'feature_seasonal_echo',
  };

  const { error } = await supabase
    .from('user_intelligence_settings')
    .update({ [columnMap[feature]]: enabled })
    .eq('user_id', user.id);

  if (error) throw error;
}
```

---

## Phase 4: Settings UI

### 4.1 Intelligence Settings Tab

Add a new "Intelligence" tab to the Settings modal.

**File:** `src/components/SettingsModal.tsx` (key additions)

```typescript
// Add to imports
import {
  fetchIntelligenceSettings,
  setTier1Enabled,
  setFeatureEnabled
} from '../services/intelligenceSettings';
import type { IntelligenceSettings } from '../types';

// Add state
const [intelligenceSettings, setIntelligenceSettings] = useState<IntelligenceSettings | null>(null);
const [loadingIntelligence, setLoadingIntelligence] = useState(false);

// Load settings on mount
useEffect(() => {
  const loadSettings = async () => {
    try {
      const settings = await fetchIntelligenceSettings();
      setIntelligenceSettings(settings);
    } catch (error) {
      console.error('Failed to load intelligence settings:', error);
    }
  };
  loadSettings();
}, []);

// Toggle handler
const handleTier1Toggle = async () => {
  if (!intelligenceSettings) return;

  const newValue = !intelligenceSettings.tier1Enabled;
  setIntelligenceSettings(prev => prev ? { ...prev, tier1Enabled: newValue } : null);

  try {
    await setTier1Enabled(newValue);
    toast.success(newValue ? 'Quiet Intelligence enabled' : 'Quiet Intelligence disabled');
  } catch (error) {
    setIntelligenceSettings(prev => prev ? { ...prev, tier1Enabled: !newValue } : null);
    toast.error('Failed to update setting');
  }
};

// Tab content
{activeTab === 'Intelligence' && (
  <div className="space-y-6">
    {/* Header */}
    <div>
      <h3 className="text-lg font-medium text-[var(--color-text-primary)]">
        Quiet Intelligence
      </h3>
      <p className="text-sm text-[var(--color-text-secondary)] mt-1">
        Helpful features that surface your own words — not AI-generated content.
      </p>
    </div>

    {/* Tier 1 Master Toggle */}
    <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-[var(--color-text-primary)]">
            Enable Pattern Recognition
          </p>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Extract tasks and intentions from your notes automatically
          </p>
        </div>
        <button
          onClick={handleTier1Toggle}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            intelligenceSettings?.tier1Enabled
              ? 'bg-[var(--color-accent)]'
              : 'bg-[var(--color-bg-tertiary)]'
          }`}
          aria-label="Toggle pattern recognition"
        >
          <span
            className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
              intelligenceSettings?.tier1Enabled ? 'left-7' : 'left-1'
            }`}
          />
        </button>
      </div>

      {/* Feature toggles (only shown when Tier 1 enabled) */}
      {intelligenceSettings?.tier1Enabled && (
        <div className="pt-4 border-t border-[var(--color-bg-tertiary)] space-y-3">
          <p className="text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">
            Features
          </p>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={intelligenceSettings.featureQuietTasks}
              onChange={() => setFeatureEnabled('featureQuietTasks', !intelligenceSettings.featureQuietTasks)}
              className="w-4 h-4 rounded border-[var(--color-text-secondary)]"
            />
            <span className="text-[var(--color-text-primary)]">Quiet Tasks</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer opacity-50">
            <input type="checkbox" disabled className="w-4 h-4 rounded" />
            <span className="text-[var(--color-text-secondary)]">Quiet Questions (coming soon)</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer opacity-50">
            <input type="checkbox" disabled className="w-4 h-4 rounded" />
            <span className="text-[var(--color-text-secondary)]">Seasonal Echo (coming soon)</span>
          </label>
        </div>
      )}
    </div>

    {/* Privacy note */}
    <p className="text-xs text-[var(--color-text-secondary)]">
      Pattern recognition runs entirely on our servers. Your notes are never sent to third-party AI services.
    </p>

    {/* Future tiers (teaser) */}
    <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg opacity-60">
      <p className="font-medium text-[var(--color-text-primary)]">
        Coming in Bloom
      </p>
      <p className="text-sm text-[var(--color-text-secondary)] mt-1">
        Resonance Threads, Daily Whisper, and more — powered by AI, with your explicit consent.
      </p>
    </div>
  </div>
)}
```

---

## Phase 5: Quiet Tasks View

### 5.1 Main Component

**File:** `src/components/QuietTasksView.tsx`

```typescript
import { useState, useEffect } from 'react';
import { HeaderShell } from './HeaderShell';
import { LoadingFallback } from './LoadingFallback';
import {
  fetchPendingTasks,
  completeTask,
  dismissTask,
  snoozeTask
} from '../services/tasks';
import type { Task } from '../types';
import toast from 'react-hot-toast';

interface QuietTasksViewProps {
  onBack: () => void;
  onNavigateToNote: (noteId: string) => void;
}

export function QuietTasksView({ onBack, onNavigateToNote }: QuietTasksViewProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const data = await fetchPendingTasks();
      setTasks(data);
    } catch (error) {
      console.error('Failed to load tasks:', error);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (task: Task) => {
    try {
      await completeTask(task.id);
      setTasks(prev => prev.filter(t => t.id !== task.id));
      toast.success('Marked as done');
    } catch (error) {
      toast.error('Failed to complete task');
    }
  };

  const handleDismiss = async (task: Task) => {
    try {
      await dismissTask(task.id);
      setTasks(prev => prev.filter(t => t.id !== task.id));
      toast('Dismissed', { icon: '👋' });
    } catch (error) {
      toast.error('Failed to dismiss');
    }
  };

  const handleSnooze = async (task: Task) => {
    try {
      const success = await snoozeTask(task.id, task.snoozeCount);
      if (success) {
        setTasks(prev => prev.filter(t => t.id !== task.id));
        toast.success('Snoozed for 1 week');
      } else {
        toast.error('Maximum snoozes reached');
      }
    } catch (error) {
      toast.error('Failed to snooze');
    }
  };

  const formatAge = (date: Date): string => {
    const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  };

  if (loading) {
    return <LoadingFallback />;
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <HeaderShell
        leftContent={
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline">Back</span>
          </button>
        }
        centerContent={
          <h1 className="text-xl font-display text-[var(--color-text-primary)]">
            Quiet Tasks
          </h1>
        }
      />

      <main className="max-w-2xl mx-auto px-4 py-8">
        {tasks.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">🍃</div>
            <p className="text-[var(--color-text-primary)] text-lg font-display">
              Nothing pressing
            </p>
            <p className="text-[var(--color-text-secondary)] text-sm mt-2 max-w-sm mx-auto">
              Tasks and intentions from your notes will appear here as you write.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
              {tasks.length} {tasks.length === 1 ? 'thing' : 'things'} bubbling up from your notes
            </p>

            {tasks.map(task => (
              <div
                key={task.id}
                className="bg-[var(--color-bg-secondary)] rounded-lg p-4 space-y-3"
              >
                {/* Task content */}
                <div className="flex items-start gap-3">
                  <span className="text-lg flex-shrink-0" title={task.type === 'checkbox' ? 'From a checklist' : 'An intention you expressed'}>
                    {task.type === 'checkbox' ? '☐' : '💭'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[var(--color-text-primary)]">
                      {task.text}
                    </p>
                    <button
                      onClick={() => onNavigateToNote(task.noteId)}
                      className="text-sm text-[var(--color-accent)] hover:underline mt-1 truncate block max-w-full"
                    >
                      in "{task.noteTitle}"
                    </button>
                  </div>
                </div>

                {/* Meta info */}
                <div className="flex items-center gap-3 text-xs text-[var(--color-text-secondary)]">
                  <span>{formatAge(task.extractedAt)}</span>
                  {task.snoozeCount > 0 && (
                    <span className="px-2 py-0.5 bg-[var(--color-bg-tertiary)] rounded">
                      Snoozed {task.snoozeCount}×
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-[var(--color-bg-tertiary)]">
                  <button
                    onClick={() => handleComplete(task)}
                    className="flex-1 px-3 py-2 text-sm bg-[var(--color-accent)] text-white rounded-md hover:opacity-90 transition-opacity"
                  >
                    Done
                  </button>
                  <button
                    onClick={() => handleSnooze(task)}
                    disabled={task.snoozeCount >= 2}
                    className="flex-1 px-3 py-2 text-sm border border-[var(--color-text-secondary)] text-[var(--color-text-secondary)] rounded-md hover:bg-[var(--color-bg-tertiary)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    title={task.snoozeCount >= 2 ? 'Maximum snoozes reached' : 'Snooze for 1 week'}
                  >
                    Snooze
                  </button>
                  <button
                    onClick={() => handleDismiss(task)}
                    className="px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-error)] transition-colors"
                    title="Won't show again"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
```

---

## Phase 6: Integration

### 6.1 Add Route to App

**File:** `src/App.tsx` (key additions)

```typescript
// Add import
const QuietTasksView = lazy(() => import('./components/QuietTasksView').then(m => ({ default: m.QuietTasksView })));

// Add state
const [view, setView] = useState<'library' | 'editor' | 'faded' | 'tasks' | 'settings'>('library');

// Add to render logic
{view === 'tasks' && (
  <Suspense fallback={<LoadingFallback />}>
    <QuietTasksView
      onBack={() => setView('library')}
      onNavigateToNote={(noteId) => {
        setSelectedNoteId(noteId);
        setView('editor');
      }}
    />
  </Suspense>
)}
```

### 6.2 Add Navigation Link

Add a link to Quiet Tasks in the header or footer. Example in footer:

```typescript
// In Footer.tsx or Header.tsx
<button
  onClick={() => onNavigateToTasks?.()}
  className="text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors"
>
  Quiet Tasks
</button>
```

---

## Phase 7: Testing

### 7.1 Unit Tests

**File:** `src/services/tasks.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchPendingTasks, completeTask, snoozeTask } from './tasks';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase');

describe('tasks service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchPendingTasks', () => {
    it('fetches pending and active snoozed tasks', async () => {
      const mockTasks = [
        { id: '1', text: 'Task 1', status: 'pending', notes: { title: 'Note 1' } },
        { id: '2', text: 'Task 2', status: 'snoozed', snoozed_until: '2020-01-01', notes: { title: 'Note 2' } },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockTasks, error: null })
          })
        })
      } as any);

      const tasks = await fetchPendingTasks();
      expect(tasks).toHaveLength(2);
    });

    it('filters out snoozed tasks that have not expired', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const mockTasks = [
        { id: '1', text: 'Task 1', status: 'pending', notes: { title: 'Note 1' } },
        { id: '2', text: 'Task 2', status: 'snoozed', snoozed_until: futureDate.toISOString(), notes: { title: 'Note 2' } },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockTasks, error: null })
          })
        })
      } as any);

      const tasks = await fetchPendingTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('1');
    });
  });

  describe('snoozeTask', () => {
    it('returns false when max snoozes reached', async () => {
      const result = await snoozeTask('task-id', 2);
      expect(result).toBe(false);
    });
  });
});
```

### 7.2 E2E Tests

**File:** `e2e/quiet-tasks.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { login, createNote } from './fixtures';

test.describe('Quiet Tasks', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);

    // Enable Quiet Intelligence in settings
    await page.click('[data-testid="settings-button"]');
    await page.click('text=Intelligence');
    await page.click('[data-testid="tier1-toggle"]');
    await page.click('[data-testid="close-modal"]');
  });

  test('extracts checkbox tasks from notes', async ({ page }) => {
    // Create note with task list
    await createNote(page, { title: 'Shopping' });
    await page.keyboard.type('/task');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Buy milk');
    await page.keyboard.press('Escape');

    // Wait for extraction (runs on save via trigger)
    await page.waitForTimeout(1000);

    // Navigate to Quiet Tasks
    await page.click('text=Quiet Tasks');

    await expect(page.locator('text=Buy milk')).toBeVisible();
    await expect(page.locator('text=☐')).toBeVisible();
  });

  test('extracts intention patterns', async ({ page }) => {
    await createNote(page, {
      title: 'Thoughts',
      content: 'I should call mom this weekend about the party.'
    });

    await page.waitForTimeout(1000);
    await page.click('text=Quiet Tasks');

    await expect(page.locator('text=Call mom this weekend about the party')).toBeVisible();
    await expect(page.locator('text=💭')).toBeVisible();
  });

  test('can complete a task', async ({ page }) => {
    await createNote(page, { title: 'Todo' });
    await page.keyboard.type('/task');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Test task');
    await page.keyboard.press('Escape');

    await page.waitForTimeout(1000);
    await page.click('text=Quiet Tasks');

    await page.click('button:has-text("Done")');
    await expect(page.locator('text=Marked as done')).toBeVisible();
    await expect(page.locator('text=Test task')).not.toBeVisible();
  });

  test('can snooze a task (max 2 times)', async ({ page }) => {
    // Create and snooze task twice
    // Verify third snooze is disabled
  });

  test('can dismiss a task', async ({ page }) => {
    // Create task, dismiss it, verify gone
  });

  test('navigates to source note', async ({ page }) => {
    // Create task, click note link, verify editor opens
  });
});
```

---

## File Summary

| File | Action | Phase |
|------|--------|-------|
| `supabase/migrations/001_intelligence_settings.sql` | Create | 1 |
| `supabase/migrations/002_note_tasks.sql` | Create | 1 |
| `supabase/migrations/003_intelligence_queue.sql` | Create | 1 |
| `supabase/migrations/004_task_extraction_trigger.sql` | Create | 2 |
| `src/types/database.ts` | Update | 3 |
| `src/types.ts` | Update | 3 |
| `src/services/tasks.ts` | Create | 3 |
| `src/services/intelligenceSettings.ts` | Create | 3 |
| `src/components/SettingsModal.tsx` | Update | 4 |
| `src/components/QuietTasksView.tsx` | Create | 5 |
| `src/App.tsx` | Update | 6 |
| `src/services/tasks.test.ts` | Create | 7 |
| `e2e/quiet-tasks.spec.ts` | Create | 7 |

---

## Future Phases

| Phase | Features | Prerequisites |
|-------|----------|---------------|
| Phase 2 | Quiet Questions | Pattern patterns for "?" sentences |
| Phase 3 | Queue processor | Edge Function infrastructure |
| Phase 4 | Resonance Threads | pgvector extension, embedding API |
| Phase 5 | Daily Whisper | LLM API integration, email service |

---

## Migration Checklist

Before deploying:

- [ ] Run migrations in order (001 → 004)
- [ ] Verify RLS policies are active
- [ ] Test trigger with sample note
- [ ] Backfill existing users' settings (optional)
- [ ] Backfill tasks from existing notes (optional one-time job)

---

*Last updated: 2026-01-14*

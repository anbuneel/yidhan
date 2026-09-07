# Search Implementation Analysis

## Current Implementation

The search is **basic but functional** - it uses PostgreSQL's `ilike` for case-insensitive substring matching.

### How It Works

| Aspect | Implementation |
|--------|----------------|
| **Fields searched** | Title and Content only |
| **Method** | PostgreSQL `ilike` with wildcards (`%query%`) |
| **Debounce** | 300ms delay before executing |
| **Keyboard shortcut** | `Cmd/Ctrl + K` to focus |

### Key Code Locations

| File | Location | Purpose |
|------|----------|---------|
| `src/App.tsx` | Lines 68-70 | State: `searchQuery`, `searchResults`, `isSearching` |
| `src/App.tsx` | Lines 485-515 | `handleSearchChange` with debounce logic |
| `src/services/notes.ts` | Lines 186-220 | `searchNotes()` service function |
| `src/components/Header.tsx` | Lines 108-180 | Search input UI component |
| `src/components/ChapteredLibrary.tsx` | Lines 94-155 | Empty state / results display |

### Search Query (from notes.ts)

```typescript
.or(`title.ilike.${searchTerm},content.ilike.${searchTerm}`)
```

Where `searchTerm` = `%${query}%` (wildcard wrapped)

### Data Flow

```
User Input (Header.tsx)
    ↓
handleSearchChange (debounce 300ms)
    ↓
searchNotes(query) → services/notes.ts
    ↓
Supabase Query:
  - Filter: deleted_at IS NULL
  - Filter: title ILIKE '%query%' OR content ILIKE '%query%'
  - Order: pinned DESC, updated_at DESC
    ↓
applyTagFilter (AND logic with selected tags)
    ↓
displayNotes → ChapteredLibrary
```

## Strengths

- **Case-insensitive** - "NOTE" finds "note", "Note", etc.
- **Substring matching** - "not" finds "notation", "cannot"
- **Respects pinned notes** - always appear first in results
- **Excludes soft-deleted** - faded notes not included
- **Debounced** - 300ms delay prevents API spam
- **Keyboard shortcut** - Cmd/Ctrl + K to focus search

## Limitations

| Limitation | Description |
|------------|-------------|
| **No fuzzy matching** | Typos won't find results ("nite" won't find "note") |
| **No relevance ranking** | Results sorted by pinned/recent, not relevance |
| **No tag search** | Tags are filtered separately, not searched |
| **No full-text search** | Basic LIKE, not PostgreSQL FTS with stemming |
| **Search clears tag filters** | Can't combine search + tag filters |
| **No search history** | No saved searches or recent queries |

## Potential Improvements

### 1. PostgreSQL Full-Text Search (FTS)

Replace `ilike` with PostgreSQL's built-in FTS for:
- Relevance ranking
- Stemming (search "running" finds "run")
- Stop word handling
- Better performance on large datasets

```sql
-- Example: Add tsvector column
ALTER TABLE notes ADD COLUMN search_vector tsvector;
CREATE INDEX notes_search_idx ON notes USING gin(search_vector);

-- Query with ranking
SELECT *, ts_rank(search_vector, query) AS rank
FROM notes, plainto_tsquery('english', 'search terms') query
WHERE search_vector @@ query
ORDER BY rank DESC;
```

### 2. Fuzzy Matching

Options:
- PostgreSQL `pg_trgm` extension for trigram similarity
- Client-side fuzzy matching with libraries like Fuse.js
- Supabase Edge Function with fuzzy logic

### 3. Search Tags

Include tag names in the search:
```typescript
// Join with tags table and search tag names too
.or(`title.ilike.${searchTerm},content.ilike.${searchTerm},tags.name.ilike.${searchTerm}`)
```

### 4. Combined Search + Tag Filters

Currently mutually exclusive. Could allow:
- Search within selected tags
- Show tag matches in search results

### 5. Search Enhancements

- **Search history** - recent searches dropdown
- **Search suggestions** - autocomplete from existing content
- **Highlighted matches** - show where query matched in results
- **Advanced syntax** - `tag:work`, `title:meeting`, date ranges

## Priority Recommendations

| Priority | Enhancement | Effort | Impact |
|----------|-------------|--------|--------|
| 1 | Search tags | Low | Medium |
| 2 | Combine search + tag filters | Medium | Medium |
| 3 | PostgreSQL FTS | High | High |
| 4 | Fuzzy matching | Medium | Medium |
| 5 | Search highlighting | Low | Low |

## References

- [Supabase Full-Text Search](https://supabase.com/docs/guides/database/full-text-search)
- [PostgreSQL FTS Documentation](https://www.postgresql.org/docs/current/textsearch.html)
- [pg_trgm Extension](https://www.postgresql.org/docs/current/pgtrgm.html)

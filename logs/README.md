# Weekly Logs

Write your logs as Markdown files! Each log should have YAML frontmatter at the top.

## Format

Create a new `.md` file in this directory (e.g., `week-2.md`) with this structure:

```markdown
---
week: 2
date: 2025-11-12
title: Week 2 Update
tags: [Engineering, Projects, Life]
---

Your log content goes here. Write paragraphs normally!

You can use **bold**, *italic*, and [links](https://example.com).

- Lists work too
- Multiple paragraphs
- No need to escape quotes or special characters

Just write naturally!
```

## Adding a New Log

1. Create a new `.md` file in this directory (e.g., `week-3.md`)
2. Add the frontmatter with:
   - `week`: Week number (optional)
   - `date`: Date in YYYY-MM-DD format
   - `title`: Log title
   - `tags`: Array of tags like `[Tag1, Tag2]` (optional)
   - `url`: Link to full post (optional)
3. Write your content below the frontmatter
4. Add the filename to `logs-index.json` in the root directory

## Example

See `week-1.md` for a complete example.


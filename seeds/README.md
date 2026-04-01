Fill seeds/lessons.json and seeds/vocabulary.json using the matching *.template.json files as examples.

Run:

```bash
npm run seed:import
```

Notes:
- Keep stable UUID values in each row so repeated imports update existing records instead of duplicating them.
- lessons.content is stored as JSONB, so it can be an array or object.
- The importer upserts by id for both lessons and vocabulary.
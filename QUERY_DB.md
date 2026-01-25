# Database Query Guide

Simple ways to inspect and query the MongoDB database.

## Option 1: MongoDB Shell (mongosh) - Simplest

Connect directly to the MongoDB container:

```bash
# Connect to the container
docker exec -it cratecaddy-mongodb mongosh cratecaddy

# Or connect from host (if mongosh is installed locally)
mongosh mongodb://localhost:27017/cratecaddy
```

Once connected, you can run queries:

```javascript
// Count all songs
db.songs.countDocuments()

// Find songs with key field
db.songs.find({key: {$exists: true}}).pretty()

// Show first 5 songs
db.songs.find().limit(5).pretty()

// Search for songs with word in title (raw JSON)
db.songs.find({title: /Jump/i}).toArray()

// Search and output as JSON (one line per document)
db.songs.find({title: /Jump/i}).forEach(doc => print(JSON.stringify(doc)))

// Count sources by type
db.songs.aggregate([
  {$unwind: '$sources'},
  {$group: {_id: '$sources.sourceType', count: {$sum: 1}}},
  {$sort: {count: -1}}
])

// Find songs with multiple sources
db.songs.find({$expr: {$gt: [{$size: '$sources'}, 1]}}).pretty()

// Find songs by artist
db.songs.find({artist: /Bailey Ibbs/i}).pretty()

// Find songs with specific key
db.songs.find({key: 'Am'}).pretty()
```

## Option 2: Query Script (TypeScript)

Use the built-in query script with common queries:

```bash
cd src/api
npm run query:db count        # Total song count
npm run query:db sample       # Show 3 sample songs
npm run query:db with-key     # Count songs with key
npm run query:db sources      # Source type statistics
npm run query:db duplicates   # Find potential duplicates
npm run query:db "search:Jump"  # Search songs by word in title (returns JSON)
```

## Option 3: One-liner Queries

Run a single query without entering the shell:

```bash
# Count documents
docker exec cratecaddy-mongodb mongosh cratecaddy --quiet --eval "db.songs.countDocuments()"

# Find songs with key
docker exec cratecaddy-mongodb mongosh cratecaddy --quiet --eval "db.songs.find({key: {$exists: true}}).count()"

# Show one song
docker exec cratecaddy-mongodb mongosh cratecaddy --quiet --eval "db.songs.findOne().pretty()"

# Search for songs with word in title (raw JSON)
docker exec cratecaddy-mongodb mongosh cratecaddy --quiet --eval "JSON.stringify(db.songs.find({title: /Jump/i}).toArray(), null, 2)"
```

**Quick search command:**
```bash
# Replace "Jump" with your search term
docker exec cratecaddy-mongodb mongosh cratecaddy --quiet --eval "JSON.stringify(db.songs.find({title: /Jump/i}).toArray(), null, 2)"
```

## Option 4: MongoDB Compass (GUI)

1. Download [MongoDB Compass](https://www.mongodb.com/products/compass)
2. Connect to: `mongodb://localhost:27017`
3. Select database: `cratecaddy`
4. Browse collections visually

## Common Queries

### Find songs with multiple sources (same song, different files)
```javascript
db.songs.find({$expr: {$gt: [{$size: '$sources'}, 1]}})
```

### Count songs by source type
```javascript
db.songs.aggregate([
  {$unwind: '$sources'},
  {$group: {_id: '$sources.sourceType', count: {$sum: 1}}},
  {$sort: {count: -1}}
])
```

### Find songs missing key
```javascript
db.songs.find({$or: [{key: {$exists: false}}, {key: null}]}).count()
```

### Find duplicate songs (same artist + title)
```javascript
db.songs.aggregate([
  {$group: {
    _id: {artist: '$artist', title: '$title'},
    count: {$sum: 1},
    ids: {$push: '$_id'}
  }},
  {$match: {count: {$gt: 1}}}
])
```

### Get source statistics
```javascript
db.songs.aggregate([
  {$unwind: '$sources'},
  {$group: {
    _id: '$sources.sourceType',
    count: {$sum: 1},
    avgFileSize: {$avg: '$sources.fileSize'},
    avgBitRate: {$avg: '$sources.bitRate'}
  }}
])
```

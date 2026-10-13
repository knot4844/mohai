-- Ontology 0.1: executable LOCAL contract harness, SQLite STRICT.
-- No production DB selected or connected. PostgreSQL migration is a later step.
PRAGMA foreign_keys = ON;
CREATE TABLE snapshots (
 id TEXT PRIMARY KEY,
 source_file TEXT NOT NULL,
 source_selector TEXT NOT NULL,
 payload_sha256 TEXT NOT NULL CHECK(length(payload_sha256)=64),
 source_version TEXT,
 raw_json TEXT NOT NULL CHECK(json_valid(raw_json)),
 storage_scope TEXT NOT NULL CHECK(storage_scope='local_research_only'),
 UNIQUE(source_file,source_selector,payload_sha256)
) STRICT;
CREATE TABLE objects (
 id TEXT PRIMARY KEY CHECK(length(id)=36),
 kind TEXT NOT NULL CHECK(kind IN ('place','event')),
 canonical_name TEXT NOT NULL CHECK(length(trim(canonical_name))>0),
 publication_state TEXT NOT NULL CHECK(publication_state='research'),
 lifecycle_state TEXT NOT NULL CHECK(lifecycle_state IN ('active','retired','merged'))
) STRICT;
CREATE TABLE places (
 object_id TEXT PRIMARY KEY REFERENCES objects(id),
 address_text TEXT,
 latitude REAL CHECK(latitude BETWEEN -90 AND 90),
 longitude REAL CHECK(longitude BETWEEN -180 AND 180),
 location_role TEXT CHECK(location_role IN ('entrance','site_reference','centroid')),
 CHECK((latitude IS NULL AND longitude IS NULL AND location_role IS NULL) OR
       (latitude IS NOT NULL AND longitude IS NOT NULL AND location_role IS NOT NULL))
) STRICT;
CREATE TABLE events (
 object_id TEXT PRIMARY KEY REFERENCES objects(id),
 starts_on TEXT,
 ends_on TEXT,
 timezone TEXT NOT NULL,
 coverage TEXT NOT NULL CHECK(coverage IN ('complete','partial','unknown')),
 status TEXT NOT NULL CHECK(status IN ('scheduled','cancelled','postponed','unknown')),
 multi_site INTEGER NOT NULL CHECK(multi_site IN (0,1)),
 CHECK(starts_on IS NULL OR ends_on IS NULL OR starts_on<=ends_on)
) STRICT;
CREATE TABLE occurrences (
 id TEXT PRIMARY KEY CHECK(length(id)=36),
 event_id TEXT NOT NULL REFERENCES events(object_id),
 starts_at TEXT,
 ends_at TEXT,
 local_date TEXT,
 timezone TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('scheduled','cancelled','postponed','unknown')),
 visit_mode TEXT NOT NULL CHECK(visit_mode IN ('fixed_start','entry_window','unknown')),
 CHECK(starts_at IS NOT NULL OR local_date IS NOT NULL),
 CHECK(ends_at IS NULL OR (starts_at IS NOT NULL AND julianday(ends_at)>julianday(starts_at)))
) STRICT;
CREATE TABLE relations (
 id TEXT PRIMARY KEY,
 from_id TEXT NOT NULL REFERENCES objects(id),
 to_id TEXT NOT NULL REFERENCES objects(id),
 predicate TEXT NOT NULL CHECK(predicate IN ('held_at','facility_reference','part_of')),
 snapshot_id TEXT NOT NULL REFERENCES snapshots(id),
 source_path TEXT NOT NULL,
 review_state TEXT NOT NULL CHECK(review_state IN ('legacy_import','proposed')),
 reason TEXT NOT NULL,
 CHECK(from_id<>to_id),
 UNIQUE(from_id,to_id,predicate)
) STRICT;
CREATE TABLE schedules (
 id TEXT PRIMARY KEY,
 object_id TEXT NOT NULL REFERENCES objects(id),
 timezone TEXT NOT NULL,
 coverage TEXT NOT NULL CHECK(coverage IN ('complete','partial','unknown')),
 raw_text TEXT,
 recurrence_json TEXT CHECK(recurrence_json IS NULL OR json_valid(recurrence_json)),
 exceptions_json TEXT NOT NULL CHECK(json_valid(exceptions_json)),
 snapshot_id TEXT NOT NULL REFERENCES snapshots(id),
 source_path TEXT NOT NULL
) STRICT;
CREATE TABLE admissions (
 id TEXT PRIMARY KEY,
 object_id TEXT NOT NULL UNIQUE REFERENCES objects(id),
 reservation_required INTEGER CHECK(reservation_required IN (0,1)),
 reservation_state TEXT NOT NULL CHECK(reservation_state IN ('known','unknown','not_applicable','conflict')),
 legacy_mode TEXT,
 raw_text TEXT,
 snapshot_id TEXT NOT NULL REFERENCES snapshots(id),
 source_path TEXT NOT NULL,
 CHECK((reservation_state='known' AND reservation_required IS NOT NULL) OR
       (reservation_state<>'known' AND reservation_required IS NULL))
) STRICT;
CREATE TABLE prices (
 id TEXT PRIMARY KEY,
 object_id TEXT NOT NULL REFERENCES objects(id),
 kind TEXT NOT NULL CHECK(kind IN ('free','paid','mixed','unknown')),
 minimum REAL CHECK(minimum>=0),
 maximum REAL CHECK(maximum>=0),
 currency TEXT,
 scope TEXT NOT NULL CHECK(scope='legacy_record_only'),
 raw_text TEXT,
 snapshot_id TEXT NOT NULL REFERENCES snapshots(id),
 source_path TEXT NOT NULL,
 CHECK(minimum IS NULL OR maximum IS NULL OR minimum<=maximum),
 CHECK((minimum IS NULL AND maximum IS NULL) OR currency IS NOT NULL)
) STRICT;
CREATE TABLE facts (
 id TEXT PRIMARY KEY,
 object_id TEXT REFERENCES objects(id),
 occurrence_id TEXT REFERENCES occurrences(id),
 field TEXT NOT NULL,
 value_json TEXT NOT NULL CHECK(json_valid(value_json)),
 knowledge_state TEXT NOT NULL CHECK(knowledge_state IN ('known','unknown','not_applicable','conflict')),
 review_state TEXT NOT NULL CHECK(review_state IN ('legacy_import','unreviewed','reviewed')),
 snapshot_id TEXT NOT NULL REFERENCES snapshots(id),
 source_path TEXT NOT NULL,
 transform TEXT NOT NULL,
 checked_at TEXT,
 checked_precision TEXT NOT NULL CHECK(checked_precision IN ('instant','date','unknown')),
 recheck_after TEXT,
 valid_from TEXT,
 valid_until TEXT,
 method TEXT NOT NULL CHECK(method='legacy_import'),
 CHECK((object_id IS NOT NULL)+(occurrence_id IS NOT NULL)=1),
 CHECK((knowledge_state='known' AND json_type(value_json)<>'null') OR
       (knowledge_state<>'known' AND json_type(value_json)='null')),
 CHECK((checked_precision='unknown' AND checked_at IS NULL) OR
       (checked_precision<>'unknown' AND checked_at IS NOT NULL))
) STRICT;
CREATE UNIQUE INDEX fact_object_field ON facts(object_id,field) WHERE object_id IS NOT NULL;
CREATE UNIQUE INDEX fact_occurrence_field ON facts(occurrence_id,field) WHERE occurrence_id IS NOT NULL;
CREATE TABLE classifications (
 id TEXT PRIMARY KEY,
 object_id TEXT NOT NULL REFERENCES objects(id),
 namespace TEXT NOT NULL,
 dimension TEXT NOT NULL CHECK(dimension IN ('kind','topic','audience_theme')),
 concept TEXT NOT NULL,
 version TEXT NOT NULL,
 snapshot_id TEXT NOT NULL REFERENCES snapshots(id),
 source_path TEXT NOT NULL,
 review_state TEXT NOT NULL CHECK(review_state='legacy_import'),
 UNIQUE(object_id,namespace,dimension,concept,version)
) STRICT;
CREATE TABLE mappings (
 id TEXT PRIMARY KEY,
 snapshot_id TEXT NOT NULL REFERENCES snapshots(id),
 source_path TEXT NOT NULL,
 legacy_id TEXT,
 target_id TEXT REFERENCES objects(id),
 disposition TEXT NOT NULL CHECK(disposition IN ('selected','reference','held')),
 reason TEXT NOT NULL,
 CHECK((disposition='held' AND target_id IS NULL) OR (disposition<>'held' AND target_id IS NOT NULL)),
 UNIQUE(snapshot_id,source_path)
) STRICT;
CREATE INDEX event_place_lookup ON relations(to_id,predicate);
CREATE INDEX occurrence_date_lookup ON occurrences(event_id,starts_at);
CREATE INDEX recheck_queue ON facts(recheck_after);
CREATE INDEX concept_lookup ON classifications(concept,object_id);
CREATE TRIGGER place_type BEFORE INSERT ON places
WHEN (SELECT kind FROM objects WHERE id=NEW.object_id)<>'place'
BEGIN SELECT RAISE(ABORT,'place subtype mismatch'); END;
CREATE TRIGGER event_type BEFORE INSERT ON events
WHEN (SELECT kind FROM objects WHERE id=NEW.object_id)<>'event'
BEGIN SELECT RAISE(ABORT,'event subtype mismatch'); END;
CREATE TRIGGER relation_type BEFORE INSERT ON relations
WHEN (NEW.predicate IN ('held_at','facility_reference') AND
     ((SELECT kind FROM objects WHERE id=NEW.from_id)<>'event' OR (SELECT kind FROM objects WHERE id=NEW.to_id)<>'place'))
 OR (NEW.predicate='part_of' AND (SELECT kind FROM objects WHERE id=NEW.from_id)<>(SELECT kind FROM objects WHERE id=NEW.to_id))
BEGIN SELECT RAISE(ABORT,'relation target type mismatch'); END;
CREATE TRIGGER containment_cycle BEFORE INSERT ON relations
WHEN NEW.predicate='part_of'
BEGIN
 SELECT RAISE(ABORT,'containment cycle') WHERE EXISTS (
  WITH RECURSIVE ancestors(id) AS (
   SELECT NEW.to_id UNION
   SELECT r.to_id FROM relations r JOIN ancestors a ON r.from_id=a.id WHERE r.predicate='part_of'
  ) SELECT 1 FROM ancestors WHERE id=NEW.from_id
 );
END;

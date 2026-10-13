"""Load a full candidate release in memory. Never connects to production."""
import json
from pathlib import Path
import sqlite3
import sys

ROOT = Path(__file__).resolve().parents[1]
TABLES = ['snapshots','objects','places','events','occurrences','relations','schedules','admissions','prices','facts','classifications','mappings']

def validate(bundle):
    db = sqlite3.connect(':memory:')
    try:
        db.executescript((ROOT / 'data/ontology/schema.sql').read_text())
        if set(bundle['tables']) != set(TABLES):
            raise ValueError('table contract mismatch')
        with db:
            for table in TABLES:
                fields = [row[1] for row in db.execute(f'PRAGMA table_info({table})')]
                for row in bundle['tables'][table]:
                    if set(row) != set(fields):
                        raise ValueError(f'{table}: column contract mismatch')
                    columns = ','.join(fields)
                    args = ','.join('?' for _ in fields)
                    db.execute(f'INSERT INTO {table} ({columns}) VALUES ({args})', [row[f] for f in fields])
            missing = db.execute('''SELECT o.id FROM objects o
                LEFT JOIN places p ON p.object_id=o.id LEFT JOIN events e ON e.object_id=o.id
                WHERE (p.object_id IS NOT NULL)+(e.object_id IS NOT NULL)<>1''').fetchall()
            if missing:
                raise ValueError('object missing exactly one subtype')
            if db.execute('PRAGMA foreign_key_check').fetchall():
                raise ValueError('foreign key check failed')
        return {'ok': True, 'engine': 'sqlite-memory-contract', 'tables': {t: len(bundle['tables'][t]) for t in TABLES}}
    finally:
        db.close()

if __name__ == '__main__':
    try:
        data = json.load(sys.stdin) if len(sys.argv) == 1 else json.loads(Path(sys.argv[1]).read_text())
        print(json.dumps(validate(data)))
    except (ValueError, KeyError, TypeError, sqlite3.Error) as error:
        print(json.dumps({'ok': False, 'error': str(error)}))
        sys.exit(1)

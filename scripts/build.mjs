import {topics,audiences} from '../public/taxonomy.js';
import fs from 'node:fs/promises';import path from 'node:path';import {messages} from '../public/i18n.js';
const root=path.resolve(new URL('..',import.meta.url).pathname);const data=JSON.parse(await fs.readFile(path.join(root,'public/data.json'),'utf8'));
const keys=Object.keys(messages.ko).sort().join('|');for(const [locale,dict] of Object.entries(messages))if(Object.keys(dict).sort().join('|')!==keys)throw new Error('Locale keys differ: '+locale);
for(const e of data.events){for(const l of Object.keys(messages))if(!e.translations[l]?.display_title)throw new Error('Missing translation: '+e.id+':'+l);}
for(const e of data.events){const v=e.verification;if(!v)throw new Error('Missing verification status: '+e.id);if(v.method==='official_page_text_review'){if(v.source_version!==e.source_version||!(Date.parse(v.recheck_after)>Date.parse(v.checked_at)))throw new Error('Invalid verification: '+e.id);for(const f of v.verified_fields)if(!v.sources.some(s=>s.fields.includes(f)&&/^https:\/\//.test(s.url)))throw new Error('Missing field evidence: '+e.id+':'+f);}}
for(const e of data.events){const c=e.editorial?.classification;if(!c)continue;if(c.source_version!==e.source_version)throw new Error('Stale classification: '+e.id);for(const id of c.topics)if(!topics.some(n=>n.id===id&&n.parent))throw new Error('Unknown subcategory: '+id);for(const id of c.audiences)if(!audiences.some(n=>n.id===id))throw new Error('Unknown audience: '+id);}
for(const n of [...topics,...audiences])for(const l of Object.keys(messages))if(!n.labels[l])throw new Error('Missing taxonomy label: '+n.id+':'+l);
for(const m of data.media)await fs.access(path.join(root,'public',m.src));
await fs.mkdir(path.join(root,'dist'),{recursive:true});await fs.cp(path.join(root,'public'),path.join(root,'dist'),{recursive:true});
console.log(`Built ${data.events.length} events, ${Object.keys(messages).length} languages, ${data.media.length} licensed photos.`);

await import('./fetch-tourapi.mjs');

import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {buildPilot,hash,TABLES} from '../lib/ontology/pilot.mjs';
import {validatePilot,freshness} from '../lib/ontology/validate.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),dir=path.join(root,'data/ontology');
const read=async name=>JSON.parse(await fs.readFile(path.join(dir,name),'utf8'));
const [manifest,sources]=await Promise.all([read('pilot-manifest.json'),read('pilot-sources.json')]);
const bundle=buildPilot(manifest,sources),errors=validatePilot(bundle);
const rerun=buildPilot(manifest,sources);
if(hash(bundle)!==hash(rerun))throw new Error('Non-deterministic canonical result');
for(const table of ['objects','places','events'])if(bundle.tables[table].length!==manifest.expected[table])errors.push({code:'pilot_count',detail:table});
const sql=spawnSync('python3',[path.join(root,'scripts/check-ontology-sql.py')],{input:JSON.stringify(bundle),encoding:'utf8',maxBuffer:2*1024*1024});
if(sql.status!==0)errors.push({code:'sql_contract',detail:sql.stdout||sql.stderr||String(sql.error)});
const report={schema_version:bundle.schema_version,as_of:bundle.as_of,mode:'offline_research',ok:errors.length===0,canonical_sha256:hash(bundle),source_sha256:bundle.source_digest,reproducible:hash(bundle)===hash(rerun),counts:Object.fromEntries(TABLES.map(t=>[t,bundle.tables[t].length])),knowledge:Object.fromEntries(['known','unknown','not_applicable','conflict'].map(s=>[s,bundle.tables.facts.filter(f=>f.knowledge_state===s).length])),freshness:Object.fromEntries(['fresh','stale','unverified','legacy_only'].map(s=>[s,bundle.tables.facts.filter(f=>freshness(f,bundle.as_of)===s).length])),errors,issues:bundle.issues,gaps:bundle.gaps,sql:sql.status===0?JSON.parse(sql.stdout):null};
if(!report.ok){console.error(JSON.stringify(report,null,2));process.exit(1);}
const outputs={'pilot.json':bundle,'pilot-report.json':report};
if(process.argv.includes('--check')){
 for(const [name,data] of Object.entries(outputs))if(await fs.readFile(path.join(dir,name),'utf8')!==JSON.stringify(data,null,2)+'\n')throw new Error('Generated artifact drift: '+name);
}else{
 // These are private research artifacts; public/ and dist/ are never touched.
 for(const [name,data] of Object.entries(outputs)){const dest=path.join(dir,name),tmp=dest+'.tmp';await fs.writeFile(tmp,JSON.stringify(data,null,2)+'\n');await fs.rename(tmp,dest);}
}
console.log(JSON.stringify({ok:true,objects:report.counts.objects,places:report.counts.places,events:report.counts.events,occurrences:report.counts.occurrences,facts:report.counts.facts,canonical_sha256:report.canonical_sha256,sql:'passed',mode:'offline_research'}));

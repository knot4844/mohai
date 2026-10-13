#!/usr/bin/env node
// Usage: node scripts/recheck-queue.mjs [--data public/data.json] [--date YYYY-MM-DD] [--now ISO]
//        [--out data/recheck-queue.json] [--md exports/recheck-queue-<date>.md] [--limit N] [--dry] [--tier P1]
// Reads the published ledger and writes the recheck queue. Never modifies data.json or verification.json,
// never fetches sources, never schedules anything.
import fs from 'node:fs';import path from 'node:path';
import {isCalendarDate} from '../lib/calendar.mjs';
import {buildRecheckQueue,renderRecheckMarkdown} from '../lib/recheck-queue.mjs';
const root=path.resolve(new URL('..',import.meta.url).pathname);
const args=process.argv.slice(2),opt=(name,fallback)=>{const i=args.indexOf('--'+name);return i>=0&&args[i+1]&&!args[i+1].startsWith('--')?args[i+1]:fallback;};
const dry=args.includes('--dry');
const now=opt('now')?Date.parse(opt('now')):Date.now();if(!Number.isFinite(now)){console.error('invalid --now');process.exit(2);}
const date=opt('date');if(date&&!isCalendarDate(date)){console.error('invalid --date');process.exit(2);}
const dataPath=path.resolve(root,opt('data','public/data.json'));
const data=JSON.parse(fs.readFileSync(dataPath,'utf8'));
const queue=buildRecheckQueue(data,{now,...(date?{date}:{})});
queue.source=path.relative(root,dataPath);
const tier=opt('tier');const view=tier?{...queue,events:queue.events.filter(e=>e.priority===tier)}:queue;
const limit=Number(opt('limit',Infinity));
const outPath=path.resolve(root,opt('out','data/recheck-queue.json')),mdPath=path.resolve(root,opt('md',`exports/recheck-queue-${queue.date}.md`));
if(!dry){fs.mkdirSync(path.dirname(outPath),{recursive:true});fs.mkdirSync(path.dirname(mdPath),{recursive:true});fs.writeFileSync(outPath,JSON.stringify(view,null,1)+'\n');fs.writeFileSync(mdPath,renderRecheckMarkdown(view,{limit}));}
console.log(JSON.stringify({date:queue.date,source:queue.source,counts:queue.counts,written:dry?null:{json:path.relative(root,outPath),md:path.relative(root,mdPath)}},null,1));

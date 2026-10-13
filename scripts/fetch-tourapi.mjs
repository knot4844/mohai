import {mergeTourAPI} from '../lib/tourapi-normalize.mjs';
import fs from 'node:fs/promises';
import {collectFestivals,enrichFestivals} from '../lib/tourapi.mjs';
const window=JSON.parse(await fs.readFile(new URL('../data/research-window.json',import.meta.url),'utf8'));
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const start=today>window.start?today:window.start;
try{
 if(!process.env.TOUR_API_SERVICE_KEY){console.log('TourAPI: not configured; existing dataset retained.');process.exit(0);}
 if(start>window.end){console.log('TourAPI: research window ended; existing dataset retained.');process.exit(0);}
 const result=await collectFestivals({key:process.env.TOUR_API_SERVICE_KEY,start,end:window.end});
 await enrichFestivals(result,{key:process.env.TOUR_API_SERVICE_KEY});
 await fs.writeFile(new URL('../dist/tourapi-snapshot.json',import.meta.url),JSON.stringify(result));
 const base=JSON.parse(await fs.readFile(new URL('../dist/data.json',import.meta.url),'utf8'));
 const regions=JSON.parse(await fs.readFile(new URL('../data/tourapi-regions.json',import.meta.url),'utf8'));
 const {data,audit}=mergeTourAPI(base,result,regions);
 await fs.writeFile(new URL('../dist/data.json',import.meta.url),JSON.stringify(data));
 await fs.writeFile(new URL('../dist/tourapi-audit.json',import.meta.url),JSON.stringify(audit));
 await fs.writeFile(new URL('../dist/place-coordinates.json',import.meta.url),JSON.stringify(data.places));
 console.log(`TourAPI merge: ${audit.added.length} new, ${audit.duplicates.length} existing, ${audit.held.length} held.`);
 console.log(`TourAPI: connected, ${result.items.length} overlapping source records, ${result.coverage.reduce((s,c)=>s+c.pages,0)} requests.`);
}catch(e){console.error('TourAPI sync failed:',/^[a-z0-9_]+$/i.test(e.code||'')?e.code:'unknown_error');process.exitCode=1;}

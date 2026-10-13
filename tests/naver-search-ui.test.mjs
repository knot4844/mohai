import test from 'node:test';
import assert from 'node:assert/strict';
import {nearbyFoodQuery,createNaverSearch} from '../public/naver-search.js';
test('NAVER query uses returned address region, never invented location',()=>{
 assert.equal(nearbyFoodQuery([{address:'경기 고양시 일산서구 중앙로 1'}]),'경기 고양시 일산서구 음식점');
 assert.equal(nearbyFoodQuery([{address:'서울 강남구 삼성동 1'}]),'서울 강남구 삼성동 음식점');
 assert.equal(nearbyFoodQuery([]),null);assert.equal(nearbyFoodQuery([{address:''}]),null);
});
test('NAVER clears failed/late results and preserves form on unrelated renders',async()=>{
 const oldDoc=globalThis.document,oldFetch=globalThis.fetch;
 class E{constructor(tag){this.tag=tag;this.children=[];this.textContent='';}append(...x){this.children.push(...x);}replaceChildren(){this.children=[];}setAttribute(){}}
 globalThis.document={createElement:tag=>new E(tag)};
 try{
  const root=new E('section'),ui=createNaverSearch(root),context={lang:'ko',enabled:true,date:'2026-10-13',origin:{point:{lat:37.6,lng:126.7}}};ui.update(context);
  const children=root.children;ui.update(context);assert.equal(root.children,children);
  let resolve;globalThis.fetch=()=>new Promise(r=>resolve=r);const pending=ui.search('일산 음식점');ui.update({...context,date:'2026-10-14'});
  resolve({ok:true,json:async()=>({result:{items:[]}})});await pending;
  const text=()=>JSON.stringify(root);assert.ok(!text().includes('검색 결과가 없습니다'));
  globalThis.fetch=async()=>({ok:true,json:async()=>({result:{items:[]}})});await ui.search('일산 음식점');assert.ok(text().includes('검색 결과가 없습니다'));
  globalThis.fetch=async()=>({ok:false});await ui.search('일산 카페');assert.ok(text().includes('검색하지 못했습니다'));assert.ok(!text().includes('검색 결과가 없습니다'));
 }finally{globalThis.document=oldDoc;globalThis.fetch=oldFetch;}
});

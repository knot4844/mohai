// A source review confirms listed fields, never live operation or ticket inventory.
export const verificationFields=['dates','hours','venue','fee','reservation','conditions','liveAvailability','entrance','languages'];
export function verificationState(event,now=Date.now()){
 const v=event.verification;
 if(v?.conflict)return 'conflict';
 if(v?.review_blocked)return 'unreviewed';
 if(!v||!['official_page_text_review','tourapi_import'].includes(v.method)||v.source_version!==event.source_version)return 'unreviewed';
 const checked=Date.parse(v.checked_at),expires=Date.parse(v.recheck_after);
 if(!Number.isFinite(checked)||!Number.isFinite(expires)||checked>now||expires<=now)return 'stale';
 return v.cached_source?'listed':'reviewed';
}
export function maySuggest(event,now=Date.now()){
 const v=event.verification;
 return !event.editorial?.multiSite&&verificationState(event,now)==='reviewed'&&['dates','hours','venue','fee','reservation'].every(k=>v.verified_fields.includes(k))&&['walk_in','onsite_registration'].includes(v.admission);
}

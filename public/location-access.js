// Detection selects help text only; users can choose a different guide.
export function locationProfile({userAgent='',platform='',maxTouchPoints=0}={}){
 const ios=/iPhone|iPad|iPod/i.test(userAgent)||(platform==='MacIntel'&&maxTouchPoints>1);
 const android=/Android/i.test(userAgent);
 const inApp=/KAKAOTALK|NAVER\(|NAVER\/|Instagram|FBAN|FBAV|; wv\)/i.test(userAgent);
 const safari=/Safari/i.test(userAgent)&&!/Chrome|CriOS|Edg|FxiOS|OPiOS|SamsungBrowser/i.test(userAgent)&&!inApp;
 return {guide:ios?(safari?'ios':'iosOther'):android?(/Chrome/i.test(userAgent)&&!/SamsungBrowser/i.test(userAgent)&&!inApp?'android':'androidOther'):(safari?'mac':'desktop'),inApp};
}
export async function requestPosition({geolocation,permissions}={}){
 if(!geolocation)throw {code:2};
 // Some browsers don't implement geolocation permission queries; keep the native request path.
 if(permissions?.query){let timer;try{const p=await Promise.race([permissions.query({name:'geolocation'}),new Promise(resolve=>{timer=setTimeout(()=>resolve(null),250);})]);if(p?.state==='denied')throw {code:1};}catch(error){if(error?.code===1)throw error;}finally{clearTimeout(timer);}}
 return new Promise((resolve,reject)=>geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:15000,maximumAge:60000}));
}

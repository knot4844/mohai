export function project(lat,lon,origin={lat:37.6562024,lon:126.7639759}) {
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>85||Math.abs(lon)>180) throw new RangeError('Invalid coordinates');
 const rad=Math.PI/180, R=6371;
 return {x:R*(lon-origin.lon)*rad*Math.cos(origin.lat*rad),y:R*Math.cos(origin.lat*rad)*(Math.log(Math.tan(Math.PI/4+lat*rad/2))-Math.log(Math.tan(Math.PI/4+origin.lat*rad/2)))};
}
export function score(place,mode,interest) {
 if(mode==='flat') return 0;
 if(mode==='demo') return place.demoScore;
 if(mode==='preference') return interest===place.tag?100:0;
 throw new Error('Unknown mode');
}
export function height(score){return Math.max(0,Math.min(100,score))/100*4;}

import {mountPhotoGraph as mountFlat} from './photo-graph.js';
// Lazy loading keeps WebGL optional and preserves selection while loading/falling back.
export function mountPhotoGraph(container,options){
 let dead=false,scene=null,selection=null,generation=0;
 const memory=options.memory||{};
 const switcher=document.createElement('button');switcher.type='button';switcher.className='spatial-switch';
 const labels={ko:['2D 보기','3D 보기','3D를 사용할 수 없어 2D로 표시합니다.'],en:['2D view','3D view','3D unavailable. Showing 2D.'],ja:['2D表示','3D表示','3Dを利用できないため2D表示します。'],'zh-Hans':['2D视图','3D视图','3D不可用，已切换为2D。']}[options.lang||'ko'];
 function flat(failed=false){scene=mountFlat(container,options);container.append(switcher);switcher.textContent=labels[1];switcher.title=failed?labels[2]:labels[1];if(failed){const notice=document.createElement('p');notice.className='spatial-error';notice.setAttribute('role','status');notice.textContent=labels[2];container.append(notice);}scene.focus(selection);}
 async function mount(){const version=++generation;scene?.destroy();scene=null;container.replaceChildren();if(memory.renderer==='2d'){flat();return;}switcher.textContent=labels[0];container.append(switcher);
 try{const {mountSpatialGraph}=await import('./spatial-graph.js');if(dead||version!==generation)return;scene=mountSpatialGraph(container,{...options,onUnavailable(){if(dead||version!==generation)return;scene?.destroy();memory.renderer='2d';flat(true);}});container.append(switcher);scene.focus(selection);}
 catch(error){if(dead||version!==generation)return;console.warn('3D renderer unavailable',error.message);memory.renderer='2d';flat(true);}}
 switcher.onclick=()=>{memory.renderer=memory.renderer==='2d'?'3d':'2d';mount();};mount();
 return {focus(id){selection=id;scene?.focus(id);},destroy(){dead=true;generation++;scene?.destroy();switcher.remove();}};
}

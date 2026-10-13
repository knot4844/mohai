import path from 'node:path';
export function resolveStaticPath(root,pathname){
 const base=path.resolve(root),target=path.resolve(base,'.'+pathname);
 return target.startsWith(base+path.sep)?target:null;
}

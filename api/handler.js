import { handleAPI } from '../lib/api.mjs';
export default async function handler(req,res){const u=new URL(req.url,'https://mohai.noado.kr');const path=req.query?.route?'/api/'+req.query.route:u.pathname;const [status,data]=await handleAPI(path,req.method,req.body);res.setHeader('Cache-Control','no-store');res.status(status).json(data);}

import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
const root = new URL('../api/', import.meta.url);
const allowed = new Set(['auth.ts','bootstrap.ts','courses.ts','leads.ts','health/sheets.ts','whatsapp/webhook.ts']);
const files=walk(root.pathname).map((file)=>relative(root.pathname,file).replaceAll('\\','/')).sort();
const unexpected=files.filter((file)=>/\.(?:ts|js|mjs|cjs)$/.test(file)&&!allowed.has(file));
if(unexpected.length){ console.error('Unexpected deployable files under api/:\n'+unexpected.map((x)=>'- '+x).join('\n')); console.error('Move helpers to server/. Only real Vercel Functions belong in api/.'); process.exit(1); }
function walk(dir){ return readdirSync(dir).flatMap((name)=>{const path=join(dir,name);return statSync(path).isDirectory()?walk(path):[path];}); }

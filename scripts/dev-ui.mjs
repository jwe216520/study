import { spawn } from 'node:child_process';
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','--port','3101'],{stdio:'inherit',env:{...process.env,STUDY_UI_TEST:'1',NEXT_PUBLIC_SUPABASE_URL:'https://study-test.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'ui-test-public-key'}});
process.on('SIGTERM',()=>child.kill());process.on('SIGINT',()=>child.kill());child.on('exit',code=>process.exit(code||0));

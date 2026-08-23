import crypto from 'node:crypto';

const COOKIE='cf_session';
const STATE='cf_oauth_state';
const GOOGLE_AUTH='https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN='https://oauth2.googleapis.com/token';
const GOOGLE_INFO='https://oauth2.googleapis.com/tokeninfo';

function base(req){return `${req.headers['x-forwarded-proto']||'https'}://${req.headers['x-forwarded-host']||req.headers.host}`}
function redirectUri(req){return process.env.GOOGLE_REDIRECT_URI||`${base(req)}/api/auth-google`}
function cookie(res,name,value,maxAge){res.setHeader('Set-Cookie',`${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`)}
function parseCookies(req){const raw=req.headers.cookie||'';return Object.fromEntries(raw.split(';').map(x=>x.trim().split('=' )).filter(x=>x.length===2).map(([k,v])=>[k,decodeURIComponent(v)]))}
function b64(v){return Buffer.from(JSON.stringify(v)).toString('base64url')}
function sign(payload){const secret=process.env.JWT_SECRET;if(!secret)throw new Error('JWT_SECRET is not configured');const h=b64({alg:'HS256',typ:'JWT'}),p=b64({...payload,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+60*60*24*30});const s=crypto.createHmac('sha256',secret).update(`${h}.${p}`).digest('base64url');return `${h}.${p}.${s}`}

export default async function handler(req,res){
 try{
  const method=req.method||'GET';
  if(!process.env.GOOGLE_CLIENT_ID||!process.env.GOOGLE_CLIENT_SECRET)return res.status(503).send('Google Login ยังไม่ได้ตั้งค่า GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET ใน Vercel');
  if(method==='GET' && !req.query?.code){
   const state=crypto.randomBytes(24).toString('hex');cookie(res,STATE,state,600);
   const u=new URL(GOOGLE_AUTH);u.searchParams.set('client_id',process.env.GOOGLE_CLIENT_ID);u.searchParams.set('redirect_uri',redirectUri(req));u.searchParams.set('response_type','code');u.searchParams.set('scope','openid email profile');u.searchParams.set('state',state);u.searchParams.set('access_type','online');
   return res.redirect(302,u.toString());
  }
  const q=req.query||{};if(q.error)return res.redirect(302,'/?auth=cancelled');
  const cookies=parseCookies(req);if(!q.code||!q.state||q.state!==cookies[STATE])return res.status(400).send('OAuth state ไม่ถูกต้อง');
  const tokenR=await fetch(GOOGLE_TOKEN,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code:String(q.code),client_id:process.env.GOOGLE_CLIENT_ID,client_secret:process.env.GOOGLE_CLIENT_SECRET,redirect_uri:redirectUri(req),grant_type:'authorization_code'})});
  const token=await tokenR.json();if(!tokenR.ok||!token.id_token)throw new Error(token.error_description||'Google token exchange failed');
  const infoR=await fetch(`${GOOGLE_INFO}?id_token=${encodeURIComponent(token.id_token)}`);const info=await infoR.json();
  if(!infoR.ok||info.aud!==process.env.GOOGLE_CLIENT_ID||info.email_verified!=='true')throw new Error('Google identity verification failed');
  const session=sign({sub:info.sub,email:info.email,name:info.name||info.email,picture:info.picture||'',provider:'google'});cookie(res,COOKIE,session,60*60*24*30);cookie(res,STATE,'',0);
  return res.redirect(302,process.env.AUTH_SUCCESS_REDIRECT||'/chat');
 }catch(e){console.error('Google OAuth:',e);return res.redirect(302,`/?auth=error&message=${encodeURIComponent(e.message)}`)}
}

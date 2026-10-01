import json, re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
expect.set_options(timeout=30000)
BASE='http://127.0.0.1:3000'
# Compare exact configured values in memory; never persist or print credentials.
secrets=[]
for line in Path('.env.local').read_text(encoding='utf-8-sig').splitlines():
 if re.match(r'^(SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|DEEPSEEK_API_KEY)=',line):
  value=line.split('=',1)[1].strip().strip('\"').strip("'")
  if len(value)>12: secrets.append(value)
with sync_playwright() as p:
 b=p.chromium.launch(channel='chrome');c=b.new_context(viewport={'width':1280,'height':900});page=c.new_page();seen=[];leaks=[];external=[]
 def inspect_request(r):
  content=r.url+json.dumps(r.headers)+(r.post_data or '')
  if any(s in content for s in secrets): leaks.append('request')
  if not r.url.startswith(BASE): external.append(r.url)
 def inspect_response(r):
  if not r.url.startswith(BASE):return
  try:
   data=r.body();seen.append(r.url)
   if any(s.encode() in data for s in secrets):leaks.append('response')
  except Exception: pass
 c.on('request',inspect_request);c.on('response',inspect_response)
 page.goto(BASE+'/radar');expect(page.locator('.job-list li')).to_have_count(8)
 page.locator('#job-6315d88f-cff0-8e58-a9b9-b44c7100e88d').click();page.get_by_role('link',name='查看完整岗位详情 →').first.click();expect(page.get_by_role('heading',name='完整 JD · 收录原文')).to_be_visible()
 assert not leaks and not external
 result={'browser_responses_scanned':len(seen),'secret_matches':len(leaks),'external_requests':len(external)}
 c.close()
 for mode in ['empty','long']:
  c=b.new_context(viewport={'width':390,'height':844});page=c.new_page();patched=[]
  def transform(obj):
   if isinstance(obj,dict):
    if 'jobs' in obj and 'sourceHealth' in obj:
     patched.append(True)
     if mode=='empty':obj['jobs']=[]
     else:
      for j in obj['jobs']:
       j['description']=(j.get('description') or j['title']) * 1000
       for g in j['gates']:
        # Long evidence is a browser-only stress case made from the same source text.
        text=j.get(g['evidence'][0]['source']) or ''
        if text:g['evidence'][0]['quote']=text;g['evidence'][0]['context']=text
    if mode=='long' and 'gates' in obj and 'application_status' in obj and 'title' in obj:
     obj['description']=(obj.get('description') or obj['title']) * (1000 if len(obj.get('description') or '')<20000 else 1)
    for v in obj.values():transform(v)
   elif isinstance(obj,list):
    for v in obj:transform(v)
  def intercept(route):
   r=route.fetch();body=r.text()
   if '_rsc=' in route.request.url:
    lines=[]
    for line in body.splitlines():
     prefix,sep,payload=line.partition(':')
     try:
      obj=json.loads(payload);transform(obj);line=prefix+':'+json.dumps(obj,ensure_ascii=False,separators=(',',':'))
     except (ValueError,TypeError):pass
     lines.append(line)
    body='\n'.join(lines)+'\n'
   route.fulfill(response=r,body=body)
  page.route('**/radar*',intercept)
  page.route('**/jobs/*',intercept)
  page.goto(BASE+'/profile');page.get_by_role('link',name='Radar',exact=True).click()
  if mode=='empty':expect(page.get_by_role('heading',name='暂时没有收录岗位')).to_be_visible()
  else:
   expect(page.locator('.job-list li')).to_have_count(8);page.locator('#job-6315d88f-cff0-8e58-a9b9-b44c7100e88d').click();page.locator('.evidence summary').first.click();page.locator('.context summary').first.click();expect(page.locator('blockquote').first).to_be_visible()
   assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
   assert page.locator('.peek-overlay').evaluate('(e)=>e.scrollWidth<=e.clientWidth')
   page.get_by_role('link',name='查看完整岗位详情 →').first.click()
   expect(page.get_by_role('heading',name='完整 JD · 收录原文')).to_be_visible()
   assert len(page.locator('section').filter(has=page.get_by_role('heading',name='岗位职责',exact=True)).locator('.raw-text').inner_text())>20000
   assert page.locator('.full-detail').evaluate('(e)=>e.scrollWidth<=e.clientWidth')
  assert patched;assert not page.evaluate('document.documentElement.scrollWidth>innerWidth');result[mode+'_browser_response_only']='passed';c.close()
 b.close();Path('.verification/m0-extra-results.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result))

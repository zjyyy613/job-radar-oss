import json,time,re
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
BASE='http://127.0.0.1:3000'
audit=json.loads(Path('.verification/phase1b/audit.json').read_text(encoding='utf-8'))
profile={'version':1,'qualification':audit['summary']['profile'],'preferences':{'preferred_cities':[],'preferred_roles':[],'preferred_companies':[]}}
by_id={r['id']:r for r in audit['evaluated']}; rank={'Eligible':0,'Check':1,'Blocked':2,'Excluded':3};results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(channel='chrome')
 for name,width,height in [('desktop',1440,1000),('mobile',390,844)]:
  ctx=browser.new_context(viewport={'width':width,'height':height},is_mobile=name=='mobile',has_touch=name=='mobile')
  ctx.add_init_script('localStorage.setItem("job-radar:guest-profile:v1",'+json.dumps(json.dumps(profile,ensure_ascii=False))+')')
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  started=time.perf_counter();page.goto(BASE+'/radar');expect(page.locator('.job-list li')).to_have_count(404);page.wait_for_timeout(350)
  load_ms=round((time.perf_counter()-started)*1000)
  ids=page.locator('.job-row').evaluate_all('(els)=>els.map(e=>e.id.replace("job-",""))')
  ranks=[rank[by_id[i]['status']] for i in ids];assert ranks==sorted(ranks)
  for status in ['Eligible','Check','Blocked']:
   if name=='mobile' and page.locator('.filter-controls').get_attribute('open') is None:page.locator('.filter-controls > summary').click()
   page.locator('select[name=status]').select_option(status);expect(page.locator('.job-list li')).to_have_count(audit['summary']['distribution'][status])
  page.locator('select[name=status]').select_option('all');page.get_by_role('searchbox').fill('腾讯');expect(page.locator('.job-list li')).to_have_count(2)
  page.locator('select[name=sort]').select_option('freshness');expect(page).to_have_url(re.compile(r'sort=freshness'));page.reload();expect(page.get_by_role('searchbox')).to_have_value('腾讯');expect(page.locator('select[name=sort]')).to_have_value('freshness')
  if name=='mobile':page.locator('.filter-controls > summary').click()
  options=page.locator('select[name=city] option').evaluate_all('(els)=>els.map(e=>e.value).filter(Boolean)');city=options[0]
  page.locator('select[name=city]').select_option(city);page.wait_for_timeout(250)
  snapshot=json.loads(Path('.verification/phase1b/after.json').read_text(encoding='utf-8'))
  expect(page.locator('.job-list li')).to_have_count(sum(j['company']=='腾讯' and city in j['location'] for j in snapshot['jobs']))
  page.locator('select[name=city]').select_option('');page.get_by_role('searchbox').fill('');page.locator('select[name=sort]').select_option('qualification');expect(page.locator('.job-list li')).to_have_count(404)
  selected=next(x for x in audit['evaluated'] if x['status']=='Blocked' and x['gates'])
  page.locator('#job-'+selected['id']).click();expect(page.locator('.job-detail')).to_be_visible();expect(page.locator('.job-detail h2').first).to_have_text('存在明确不符合项')
  page.locator('.evidence summary').first.click();expect(page.locator('blockquote').first).to_be_visible()
  page.screenshot(path=f'.verification/phase1b/{name}-inspect.png')
  assert not errors;results.append({'surface':name,'jobs':404,'load_ms':load_ms,'qualification_sort':'pass','search':'pass','status_filters':'pass','city_filter':'pass','detail':'pass','page_errors':errors})
  ctx.close()
 browser.close()
Path('.verification/phase1b/browser.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(results,ensure_ascii=False))

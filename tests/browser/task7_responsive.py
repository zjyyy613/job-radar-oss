import json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
BASE='http://127.0.0.1:3000'
results=[]
with sync_playwright() as p:
 b=p.chromium.launch(channel='chrome')
 for width in [390,768,1100,1280,2560]:
  context=b.new_context(viewport={'width':width,'height':900});page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  patched=[]
  def intercept(route):
   response=route.fetch();body=response.text()
   if '_rsc=' in route.request.url and 'sourceHealth' in body:
    pos=body.index('sourceHealth');body=body[:pos]+body[pos:].replace('success','failed',1);patched.append(True)
   route.fulfill(response=response,body=body)
  page.route('**/radar*',intercept)
  page.goto(BASE+'/profile');page.get_by_role('link',name='Radar',exact=True).click()
  expect(page.get_by_text('部分来源更新受限：',exact=False)).to_be_visible();expect(page.locator('.job-list li')).to_have_count(8);assert patched
  page.locator('#job-58bcedda-14fa-8c66-a055-0a17e9009d49').click();expect(page.locator('.job-detail h1')).to_have_text('Agent开发工程师')
  assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
  if width<1280:
   expect(page.get_by_role('dialog')).to_be_visible();page.keyboard.press('Escape');expect(page.get_by_role('dialog')).to_have_count(0)
  else:
   expect(page.locator('.detail-pane')).to_be_visible();page.get_by_role('button',name='收起详情').click()
  # Real long title and long JD across breakpoints, not fake persisted data.
  page.locator('#job-c83965bc-af1c-8ba5-a455-128b1fd86cdb').click();expect(page.locator('.job-detail h1')).to_contain_text('中国银行')
  assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
  page.screenshot(path=f'.verification/task7-responsive-{width}.png')
  if width<1280:page.get_by_role('button',name='返回岗位列表').click()
  else:page.get_by_role('button',name='收起详情').click()
  expect(page.locator('.job-detail')).to_have_count(0)
  expect(page.locator('#job-c83965bc-af1c-8ba5-a455-128b1fd86cdb')).to_be_focused()
  page.locator('#job-6315d88f-cff0-8e58-a9b9-b44c7100e88d').focus();page.keyboard.press('Enter');expect(page.locator('.job-detail h1')).to_contain_text('蓝极星')
  page.get_by_role('link',name='查看完整岗位详情 →').first.click();expect(page.get_by_role('heading',name='完整 JD · 收录原文')).to_be_visible();assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
  if width==390:
   targets=page.locator('main a,main button').evaluate_all('(els)=>els.filter(e=>e.getBoundingClientRect().height>0).map(e=>({text:e.textContent,height:e.getBoundingClientRect().height}))')
   assert all(t['height']>=44 for t in targets),targets
  results.append({'width':width,'single_source_failure':'ncss failed (browser response only)','jobs_usable':8,'keyboard':True,'overflow':False,'errors':errors});assert not errors;context.close()
 Path('.verification/task7-responsive-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(results,ensure_ascii=False,indent=2));b.close()

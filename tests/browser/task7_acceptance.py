import json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
BASE='http://127.0.0.1:3000'
ID='6315d88f-cff0-8e58-a9b9-b44c7100e88d'
results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(channel='chrome')
 for name,width,height in [('desktop',1440,1000),('mobile',390,844)]:
  context=browser.new_context(viewport={'width':width,'height':height},is_mobile=name=='mobile',has_touch=name=='mobile')
  page=context.new_page(); errors=[]; requests=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('request',lambda r:requests.append(r.url))
  page.goto(BASE); expect(page).to_have_url(BASE+'/radar'); expect(page.locator('.job-list li')).to_have_count(8); expect(page.locator('.job-detail')).to_have_count(0)
  page.get_by_role('link',name='填写资格资料 →').click()
  page.locator('#student_status').select_option('enrolled');page.locator('#graduation_year').fill('2027');page.locator('#education').select_option('bachelor');page.locator('#major').fill('机械工程')
  page.get_by_role('button',name='继续',exact=True).click();page.get_by_role('button',name='保存到此浏览器',exact=True).click();expect(page).to_have_url(BASE+'/radar')
  expect(page.locator('.job-list li')).to_have_count(8)
  page.get_by_role('searchbox').fill('vivo');expect(page.locator('.job-list li')).to_have_count(2)
  if name=='mobile': page.locator('.filter-controls > summary').click()
  page.locator('select[name=city]').select_option('广东省·深圳市');expect(page.locator('.job-list li')).to_have_count(1)
  page.locator('select[name=sort]').select_option('freshness');page.wait_for_timeout(200); url=page.url
  page.reload();expect(page.get_by_role('searchbox')).to_have_value('vivo');expect(page.locator('select[name=sort]')).to_have_value('freshness')
  if name=='mobile': page.locator('.filter-controls > summary').click()
  page.locator('select[name=sort]').select_option('qualification');page.wait_for_timeout(200);page.go_back();expect(page.locator('select[name=sort]')).to_have_value('freshness');page.go_forward();expect(page.locator('select[name=sort]')).to_have_value('qualification')
  page.locator('#job-'+ID).click();expect(page.locator('.job-detail h2').first).to_have_text('存在明确不符合项')
  page.reload();expect(page.locator('.job-detail h2').first).to_have_text('存在明确不符合项')
  page.locator('.evidence summary').first.click();expect(page.locator('blockquote').first).to_be_visible(); quote=page.locator('blockquote').first.inner_text(); assert quote=='2027届获得博士学历' or '2027届获得博士学历' in quote
  page.locator('.context summary').first.click();expect(page.locator('.context p').first).to_be_visible();assert quote in page.locator('.context p').first.inner_text()
  if name=='desktop':
   sep=page.get_by_role('separator');sep.focus(); before=page.locator('.detail-pane').bounding_box()['width'];sep.press('ArrowLeft');page.wait_for_timeout(200);after=page.locator('.detail-pane').bounding_box()['width'];assert before!=after
   saved=page.evaluate("localStorage.getItem('job-radar:detail-width')");assert saved and 520<=float(saved)<=760
   page.reload();expect(page.locator('.detail-pane')).to_be_visible();assert abs(page.locator('.detail-pane').bounding_box()['width']-float(saved))<3
  else:
   expect(page.get_by_role('dialog')).to_be_visible();assert page.locator('.peek-overlay').bounding_box()['width']==width
   assert page.locator('input[name=q]').evaluate('(e)=>getComputedStyle(e).fontSize')=='16px'
  page.screenshot(path=f'.verification/task7-{name}-peek.png')
  page.get_by_role('link',name='查看完整岗位详情 →').first.click();expect(page.get_by_role('heading',name='完整 JD · 收录原文')).to_be_visible();assert '/jobs/'+ID in page.url
  with page.expect_popup() as popup:
   page.get_by_role('link',name='官网投递 ↗',exact=True).click()
  external=popup.value
  try: external.wait_for_load_state('domcontentloaded',timeout=20000)
  except Exception: pass
  assert 'vivo' in external.url;apply_url=external.url;external.close()
  page.screenshot(path=f'.verification/task7-{name}-full.png')
  page.get_by_role('link',name='← 返回 Radar').click();expect(page.locator('.job-detail')).to_be_visible()
  if name=='mobile':page.get_by_role('button',name='返回岗位列表').click()
  else:page.get_by_role('button',name='收起详情').click()
  expect(page.locator('.job-detail')).to_have_count(0);expect(page.locator('#job-'+ID)).to_be_focused()
  page.get_by_role('link',name='Profile',exact=True).click();page.get_by_role('button',name='修改资料',exact=True).click();page.locator('#education').select_option('doctorate')
  page.locator('#preferred_cities').fill('火星');page.locator('#preferred_roles').fill('其他');page.locator('#preferred_companies').fill('其他')
  n=len(requests);page.get_by_role('button',name='保存修改',exact=True).click();page.wait_for_timeout(200);assert len(requests)==n
  page.get_by_role('link',name='Radar',exact=True).click();page.locator('#job-'+ID).click();expect(page.locator('.job-detail h2').first).to_have_text('当前条件无明显冲突')
  if name=='mobile':page.get_by_role('button',name='返回岗位列表').click()
  else:page.get_by_role('button',name='收起详情').click()
  page.get_by_role('searchbox').fill('没有这个岗位');expect(page.get_by_role('heading',name='没有符合筛选条件的岗位')).to_be_visible();page.get_by_role('button',name='清除筛选').click();expect(page.locator('.job-list li')).to_have_count(8)
  assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
  page.emulate_media(reduced_motion='reduce'); assert page.locator('.job-row').first.evaluate('(e)=>getComputedStyle(e).transitionDuration')=='0s'
  page.goto(BASE+'/radar?job=missing');expect(page.get_by_text('该岗位不存在或已不可读取。')).to_be_visible();page.get_by_role('button',name='返回岗位列表').click();expect(page.locator('.job-list li')).to_have_count(8)
  page.goto(BASE+'/jobs/missing');expect(page.get_by_role('heading',name='没有找到该岗位')).to_be_visible()
  results.append({'surface':name,'flow':'passed','initial_jobs':8,'evidence_quote':quote,'official_apply_url':apply_url,'profile_save_requests':0,'page_errors':errors})
  assert not errors
  context.close()
 Path('.verification/task7-browser-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps(results,ensure_ascii=False,indent=2))
 browser.close()

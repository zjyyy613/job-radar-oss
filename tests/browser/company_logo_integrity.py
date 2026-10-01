from pathlib import Path
from playwright.sync_api import sync_playwright, expect
expect.set_options(timeout=30000)
BASE='http://127.0.0.1:3000'
with sync_playwright() as p:
 b=p.chromium.launch(channel='chrome');c=b.new_context(viewport={'width':1600,'height':1000});page=c.new_page();errors=[];requests=[]
 page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url))
 page.goto(BASE+'/onboarding');page.locator('#student_status').select_option('enrolled');page.locator('#graduation_year').fill('2027');page.locator('#education').select_option('bachelor');page.locator('#major').fill('机械工程');page.get_by_role('button',name='继续',exact=True).click();page.get_by_role('button',name='保存到此浏览器').click()
 expect(page.locator('.job-list li')).to_have_count(8)
 tencent=page.locator('.job-row').filter(has=page.locator('.row-company',has_text='腾讯'))
 expect(tencent).to_have_count(2)
 for row in tencent.all():
  expect(row.locator('.company-mark img')).to_have_count(0);expect(row.locator('.company-mark')).to_have_text('腾')
 for row in page.locator('.job-row').filter(has=page.locator('.row-company',has_text='vivo')).all():
  expect(row.locator('.company-mark')).to_have_text('V');expect(row.locator('.company-mark img')).to_have_count(0)
 expect(page.locator('.job-row .company-mark img')).to_have_count(3)
 for img in page.locator('.job-row .company-mark img').all():
  expect(img).to_be_visible();assert img.evaluate('(e)=>e.complete&&e.naturalWidth>0')
  assert img.bounding_box()['width']==28
 assert tencent.first.locator('.company-mark').bounding_box()['width']==34
 assert page.locator('.row-signal.tone-blocked').count()==3
 assert not any('tencent.png' in u or 'vivo.ico' in u for u in requests)
 out=Path('docs/reports/assets/company-logo-integrity');out.mkdir(parents=True,exist_ok=True)
 page.screenshot(path=str(out/'desktop-radar.png'))
 # Actual React image onError path, not a reimplementation in a unit stub.
 c.route('**/company-marks/xiaomi.ico',lambda route:route.abort())
 page.reload();expect(page.locator('.job-list li')).to_have_count(8)
 for row in page.locator('.job-row').filter(has=page.locator('.row-company',has_text='小米')).all():
  expect(row.locator('.company-mark img')).to_have_count(0);expect(row.locator('.company-mark')).to_have_text('小')
 page.set_viewport_size({'width':390,'height':844})
 assert tencent.first.locator('.company-mark').bounding_box()['width']==24
 assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
 assert not errors
 print('PASS: 8 real jobs; Tencent/Vivo fallback; 3 curated images; load error fallback; unchanged desktop/mobile sizes; 0 page errors')
 b.close()

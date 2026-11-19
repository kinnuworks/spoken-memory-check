import { chromium } from 'playwright'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1600, height: 494 }, deviceScaleFactor: 2 })
await p.goto('file://' + process.cwd() + '/scripts/workflow-diagram.html')
console.log('scroll', await p.evaluate(() => [document.body.scrollWidth, document.body.scrollHeight]))
await p.screenshot({ path: 'docs/images/workflow.png' }); await b.close()

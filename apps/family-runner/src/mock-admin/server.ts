import express from 'express'
import path from 'path'

const app = express()
const port = parseInt(process.env.MOCK_FAMILY_ADMIN_PORT ?? '3100', 10)

app.use(express.static(path.join(__dirname, 'public')))

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'mock-family-admin', demoOnly: true })
})

app.listen(port, () => {
  console.log(`[mock-family-admin] DEMO ONLY listening on http://0.0.0.0:${port}`)
})

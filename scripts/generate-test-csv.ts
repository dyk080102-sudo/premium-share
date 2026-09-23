/**
 * Generates a test bank CSV with 1000 virtual transactions
 * Usage: npx tsx scripts/generate-test-csv.ts > test-transactions.csv
 */

const DEPOSITOR_NAMES = ['김철수', '이영희', '박민준', '최서연', '정재원', '강지영', '윤성호', '임지현', '한상훈', '오미래']
const AMOUNTS = [2900, 3900, 4500, 7800, 10500, 12000, 29000, 39000]

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
}

function formatDate(date: Date): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function pad(n: number, len: number): string {
  return String(n).padStart(len, '0')
}

// CSV Header
console.log('거래일시,금액(원),입금자명,메모,외부거래ID')

const start = new Date('2024-01-01')
const end = new Date('2024-12-31')

for (let i = 1; i <= 1000; i++) {
  const date = randomDate(start, end)
  const amount = randomItem(AMOUNTS)
  const depositor = randomItem(DEPOSITOR_NAMES)
  const externalId = `TXTEST${pad(i, 8)}`
  const memo = `PremiumShare 입금 ${Math.floor(Math.random() * 9999)}`

  console.log(`${formatDate(date)},${amount},${depositor},${memo},${externalId}`)
}

process.stderr.write(`Generated 1000 test transactions\n`)

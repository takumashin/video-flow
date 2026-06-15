import { BILLINGClient, QueryBalanceAcctCommand } from '@volcengine/billing'

export type VolcengineBillingCredentials = {
  accessKeyId: string
  secretAccessKey: string
}

export type VolcengineAccountBalance = {
  accountId?: number
  availableBalance: string
  cashBalance: string
  arrearsBalance: string
  creditLimit: string
  freezeAmount: string
}

const CONSOLE_BALANCE_URL = 'https://console.volcengine.com/finance/account/overview'

export function getVolcengineBillingCredentials(): VolcengineBillingCredentials | null {
  const accessKeyId =
    process.env.VOLC_ACCESS_KEY_ID
    ?? process.env.VOLCSTACK_ACCESS_KEY_ID
    ?? process.env.VOLCSTACK_ACCESS_KEY

  const secretAccessKey =
    process.env.VOLC_SECRET_ACCESS_KEY
    ?? process.env.VOLCSTACK_SECRET_ACCESS_KEY
    ?? process.env.VOLCSTACK_SECRET_KEY

  if (!accessKeyId?.trim() || !secretAccessKey?.trim())
    return null

  return {
    accessKeyId: accessKeyId.trim(),
    secretAccessKey: secretAccessKey.trim(),
  }
}

export function getVolcengineBalanceConsoleUrl(): string {
  return CONSOLE_BALANCE_URL
}

export async function queryVolcengineAccountBalance(): Promise<VolcengineAccountBalance> {
  const credentials = getVolcengineBillingCredentials()
  if (!credentials)
    throw new Error(
      '未配置火山费用中心凭据。请在 .env.local 中设置 VOLC_ACCESS_KEY_ID 与 VOLC_SECRET_ACCESS_KEY（IAM 访问密钥，非 ARK_API_KEY）',
    )

  const client = new BILLINGClient({
    region: 'cn-beijing',
    accessKeyId: credentials.accessKeyId,
    secretAccessKey: credentials.secretAccessKey,
  })

  const response = await client.send(new QueryBalanceAcctCommand({}))
  const result = response.Result

  if (!result)
    throw new Error('费用中心未返回余额数据')

  return {
    accountId: result.AccountID,
    availableBalance: result.AvailableBalance ?? '0',
    cashBalance: result.CashBalance ?? '0',
    arrearsBalance: result.ArrearsBalance ?? '0',
    creditLimit: result.CreditLimit ?? '0',
    freezeAmount: result.FreezeAmount ?? '0',
  }
}

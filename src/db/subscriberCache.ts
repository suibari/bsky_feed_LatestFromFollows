import { Kysely } from "kysely"
import { DatabaseSchema } from "./schema.js"

// インデックス対象のDIDを管理するメモリ内セット
let subTargetDidSet: Set<string> = new Set()

// 指定したDIDがインデックス対象か確認する
export function isSubscribedDid(did: string): boolean {
  return subTargetDidSet.has(did)
}

// インデックス対象に即座に追加する（DB保存後の呼び出しを想定）
export function addSubTarget(did: string) {
  subTargetDidSet.add(did)
}

// DBからインデックス対象のリストを読み込み、キャッシュを更新する
async function refreshSubscriberCache(db: Kysely<DatabaseSchema>) {
  try {
    const rows = await db.selectFrom('sub_target').select(['did']).execute()
    subTargetDidSet = new Set(rows.map((row) => row.did))
    console.log(`✅ Subscriber cache refreshed. Total: ${subTargetDidSet.size}`)
  } catch (err) {
    console.error('⚠ Failed to refresh subscriber cache:', err)
  }
}

// キャッシュの初期化と定期的な更新（デフォルト1分）を開始する
export function initSubscriberCache(db: Kysely<DatabaseSchema>, intervalMs = 60000) {
  refreshSubscriberCache(db) // 初回読み込み
  setInterval(() => refreshSubscriberCache(db), intervalMs) // 定期更新
}

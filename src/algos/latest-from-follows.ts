import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton.js'
import { AppContext } from '../config.js'
import { agent } from '../login.js'
import { addSubTarget } from '../db/subscriberCache.js'

export const shortname = 'latestFromFollows'

export const handler = async (ctx: AppContext, params: QueryParams, requesterDid: string) => {
  const PAGE_SIZE = Math.min(params.limit ?? 100, 100)
  const now = new Date()

  // 1. リクエストユーザーのフォローリストを全件取得 (AppViewより)
  let follows: string[] = []
  try {
    let cursor: string | undefined
    while (true) {
      const res = await agent.getFollows({
        actor: requesterDid,
        limit: 100,
        cursor,
      })
      follows.push(...res.data.follows.map((f) => f.did))
      cursor = res.data.cursor
      if (!cursor) break

      // 無限ループ防止とAPI負荷軽減のため、現実的な上限を設ける
      if (follows.length > 10000) break
    }
  } catch (err) {
    console.error(`[${requesterDid}] Failed to fetch follows:`, err)
  }

  // 2. フォロイーをインデックス対象としてDBとキャッシュに登録 (Lazy Subscription)
  if (follows.length > 0) {
    // 効率化のため、未登録のDIDのみを抽出してバルクインサート
    const existingTargets = await ctx.db
      .selectFrom('sub_target')
      .where('did', 'in', follows)
      .select('did')
      .execute()

    const existingDidSet = new Set(existingTargets.map(t => t.did))
    const newTargets = follows.filter(did => !existingDidSet.has(did))

    if (newTargets.length > 0) {
      await ctx.db
        .insertInto('sub_target')
        .values(newTargets.map(did => ({ did, indexedAt: now.toISOString() })))
        .onConflict(oc => oc.doNothing())
        .execute()

      // メモリ内キャッシュにも即座に反映
      for (const did of newTargets) {
        addSubTarget(did)
      }
      console.log(`[${requesterDid}] Registered ${newTargets.length} new sub_targets.`)
    }
  }

  // 3. DBからフォロイーの最新投稿を取得
  // 各ユーザー1件のみなので、単純にフォロイーリストでIN句を使って取得しソートする
  let postQuery = ctx.db
    .selectFrom('post')
    .select(['uri', 'indexedAt'])
    .where('did', 'in', follows)
    .orderBy('indexedAt', 'desc')
    .limit(PAGE_SIZE)

  // ページネーション用カーソルの処理 (indexedAtを使用)
  if (params.cursor) {
    postQuery = postQuery.where('indexedAt', '<', params.cursor)
  }

  const posts = await postQuery.execute()

  // 4. 次のカーソルを生成
  let nextCursor: string | undefined = undefined
  if (posts.length === PAGE_SIZE) {
    nextCursor = posts[posts.length - 1].indexedAt
  }

  console.log(`[${requesterDid}] total follows: ${follows.length}, returned posts: ${posts.length}`)

  return {
    cursor: nextCursor,
    feed: posts.map((p) => ({
      post: p.uri,
    })),
  }
}

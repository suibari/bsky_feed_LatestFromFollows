export type DatabaseSchema = {
  sub_state: SubState
  post: Post
  sub_target: SubTarget
}

export type SubState = {
  service: string
  cursor: number
}

// インデックス対象のポスト情報を保存するテーブル
export type Post = {
  uri: string
  cid: string
  did: string // 投稿者のDID
  indexedAt: string
}

// フィード利用者のフォロイーなど、インデックス対象とするDIDを管理するテーブル
export type SubTarget = {
  did: string
  indexedAt: string
}

import { isSubscribedDid } from './db/subscriberCache.js'
import { Database } from './db/index.js'
import { CommitCreateEvent, CommitDeleteEvent, Jetstream } from '@skyware/jetstream'
import Websocket from 'ws'

export class JetstreamSubscription {
  private client: InstanceType<typeof Jetstream>
  private db: Database

  constructor(db: Database) {
    this.db = db
    this.client = new Jetstream({
      ws: Websocket,
      // ポストの作成・削除イベントを監視する
      wantedCollections: ['app.bsky.feed.post'],
    });
    this.client.url = new URL(process.env.URL_JETSTREAM || 'wss://jetstream1.us-east.bsky.network/subscribe');
  }

  async run() {
    this.client.onCreate("app.bsky.feed.post", (evt: CommitCreateEvent<any>) => {
      this.handleCreateEvent(evt)
    });

    this.client.onDelete("app.bsky.feed.post", (evt: CommitDeleteEvent<any>) => {
      this.handleDeleteEvent(evt)
    });

    this.client.start();
  }

  // ポスト作成時の処理
  private async handleCreateEvent(evt: CommitCreateEvent<any>) {
    // 投稿者がインデックス対象（誰かのフォロイー）でない場合は無視
    if (!isSubscribedDid(evt.did)) return

    const post = {
      did: evt.did,
      uri: `at://${evt.did}/app.bsky.feed.post/${evt.commit.rkey}`,
      cid: evt.commit.cid,
      indexedAt: new Date().toISOString(),
    }

    // ユーザーごとに最新1件のみ保持するため、didが重複した場合は上書き（upsert）
    await this.db
      .insertInto('post')
      .values(post)
      .onConflict((oc) =>
        oc.column('did').doUpdateSet({
          uri: post.uri,
          cid: post.cid,
          indexedAt: post.indexedAt,
        })
      )
      .execute()
  }

  // ポスト削除時の処理
  private async handleDeleteEvent(evt: CommitDeleteEvent<any>) {
    const fullUri = `at://${evt.did}/app.bsky.feed.post/${evt.commit.rkey}`

    // 該当するポストがDBにあれば削除する
    await this.db
      .deleteFrom('post')
      .where('uri', '=', fullUri)
      .execute()
  }
}

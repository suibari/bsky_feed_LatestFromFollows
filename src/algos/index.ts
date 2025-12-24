import { AppContext } from '../config.js'
import {
  QueryParams,
  OutputSchema as AlgoOutput,
} from '../lexicon/types/app/bsky/feed/getFeedSkeleton.js'
import * as latestFromFollows from './latest-from-follows.js'

type AlgoHandler = (ctx: AppContext, params: QueryParams, requesterDid: string) => Promise<AlgoOutput>

// 利用可能なアルゴリズムのハンドラーを登録
const algos: Record<string, AlgoHandler> = {
  [latestFromFollows.shortname]: latestFromFollows.handler,
}

export default algos

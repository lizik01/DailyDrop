import { buildDigest, onboardSubscriber, scheduleDigests } from './digest'
import { ingestNews } from './ingest'

export const functions = [ingestNews, scheduleDigests, buildDigest, onboardSubscriber]

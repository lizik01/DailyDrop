import Link from 'next/link'

export default async function Thanks({ searchParams }: PageProps<'/thanks'>) {
  const params = await searchParams
  const [title, body] = params.unsubscribed
    ? ['You’ve been unsubscribed.', 'No more drops. Sorry to see you go.']
    : ['You’re in.', 'Check your inbox for a welcome email. Your first digest is being written now.']
  return (
    <div className="space-y-3 pt-16 text-center">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="text-zinc-600">{body}</p>
      <Link href="/" className="inline-block pt-4 text-sm text-brand">Back to DailyDrop</Link>
    </div>
  )
}

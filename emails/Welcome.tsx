import { Body, Container, Head, Heading, Html, Link, Preview, Text } from '@react-email/components'

export type WelcomeProps = {
  summary: string
  topics: string[]
  sendHour: number
  manageUrl: string
}

export default function Welcome({ summary, topics, sendHour, manageUrl }: WelcomeProps) {
  const time = new Date(2000, 0, 1, sendHour).toLocaleTimeString('en-US', { hour: 'numeric' })
  return (
    <Html lang="en">
      <Head />
      <Preview>Your first drop is on its way.</Preview>
      <Body style={{ backgroundColor: '#f4f4f5', fontFamily: 'Inter, -apple-system, Segoe UI, sans-serif' }}>
        <Container style={{ maxWidth: 560, margin: '24px auto', backgroundColor: '#ffffff', borderRadius: 14, padding: '28px 32px' }}>
          <Heading as="h1" style={{ fontSize: 22, color: '#111827' }}>Welcome to DailyDrop</Heading>
          <Text style={{ color: '#374151', fontSize: 15, lineHeight: '24px' }}>Here’s what our AI editor understood from what you wrote:</Text>
          <Text style={{ color: '#111827', fontSize: 15, lineHeight: '24px', fontStyle: 'italic' }}>“{summary}”</Text>
          <Text style={{ color: '#374151', fontSize: 15, lineHeight: '24px' }}>
            Watching for: {topics.join(', ')}.
          </Text>
          <Text style={{ color: '#374151', fontSize: 15, lineHeight: '24px' }}>
            Your first digest is being written now. After that it arrives every day around {time}.
          </Text>
          <Link href={manageUrl} style={{ color: '#4f46e5', fontSize: 14 }}>Not quite right? Adjust it here.</Link>
        </Container>
      </Body>
    </Html>
  )
}

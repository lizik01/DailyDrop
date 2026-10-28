import { Body, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from '@react-email/components'

export type DigestEmailItem = {
  headline: string
  blurb: string
  whyYou: string
  source: string
  url: string
}

export type DailyDigestProps = {
  name?: string | null
  subject: string
  intro: string
  dateLabel: string
  items: DigestEmailItem[]
  manageUrl: string
  unsubscribeUrl: string
}

const ink = '#111827'
const muted = '#6b7280'
const accent = '#4f46e5'

export default function DailyDigest(props: DailyDigestProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{props.intro}</Preview>
      <Body style={{ backgroundColor: '#f4f4f5', fontFamily: 'Inter, -apple-system, Segoe UI, sans-serif', margin: 0 }}>
        <Container style={{ maxWidth: 600, margin: '24px auto', backgroundColor: '#ffffff', borderRadius: 14, padding: '28px 32px' }}>
          <Text style={{ margin: 0, color: accent, fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>
            DAILYDROP · {props.dateLabel.toUpperCase()}
          </Text>
          <Heading as="h1" style={{ color: ink, fontSize: 24, lineHeight: '30px', margin: '8px 0 12px' }}>
            {props.subject}
          </Heading>
          <Text style={{ color: '#374151', fontSize: 15, lineHeight: '24px' }}>
            {props.name ? `Morning, ${props.name}. ` : ''}
            {props.intro}
          </Text>

          {props.items.map((item, i) => (
            <Section key={i} style={{ borderTop: '1px solid #e5e7eb', padding: '18px 0 6px' }}>
              <Link href={item.url} style={{ color: ink, fontSize: 18, fontWeight: 700, lineHeight: '24px', textDecoration: 'none' }}>
                {i + 1}. {item.headline}
              </Link>
              <Text style={{ color: muted, fontSize: 12, margin: '4px 0 8px' }}>{item.source}</Text>
              <Text style={{ color: '#374151', fontSize: 15, lineHeight: '23px', margin: '0 0 8px' }}>{item.blurb}</Text>
              <Text style={{ color: accent, fontSize: 13, lineHeight: '20px', margin: 0 }}>↳ {item.whyYou}</Text>
            </Section>
          ))}

          <Hr style={{ borderColor: '#e5e7eb', margin: '20px 0' }} />
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>
            Picked for you by DailyDrop’s AI editor.{' '}
            <Link href={props.manageUrl} style={{ color: '#9ca3af' }}>Change your interests</Link> ·{' '}
            <Link href={props.unsubscribeUrl} style={{ color: '#9ca3af' }}>Unsubscribe</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

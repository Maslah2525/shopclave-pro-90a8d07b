import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props { storeName?: string }

const SellerApprovedEmail = ({ storeName }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Barakaz store is approved</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Your store is approved 🎉</Heading>
        <Text style={text}>{storeName ? `Great news — ${storeName} is now approved on Barakaz.` : 'Great news — your store is now approved on Barakaz.'}</Text>
        <Text style={text}>You can now add products and start selling.</Text>
        <Button style={button} href="https://barakaz.com/vendor/dashboard">Open your dashboard</Button>
        <Text style={small}>Questions? Contact support@barakaz.com</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SellerApprovedEmail,
  subject: 'Your Barakaz store is approved',
  displayName: 'Seller approved',
  previewData: { storeName: 'Mama Shop' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px' }
const h1 = { fontSize: '22px', color: '#111111' }
const text = { fontSize: '14px', color: '#333333', lineHeight: '22px' }
const small = { fontSize: '12px', color: '#777777', marginTop: '24px' }
const button = { backgroundColor: '#ff420e', color: '#ffffff', padding: '12px 20px', borderRadius: '8px', fontSize: '14px', textDecoration: 'none' }
